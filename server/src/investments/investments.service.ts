import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  accounts,
  quotes,
  securities,
  trades,
  transactions,
  type Trade,
} from '../database/schema';
import { computeFingerprint } from '../common/fingerprint';
import {
  CreateTradeDto,
  PositionQueryDto,
  QuoteQueryDto,
  TradeQueryDto,
  UpdateSecurityDto,
} from './investments.dto';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
    }>;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export interface Position {
  security: string;
  units: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPL: number | null;
}

export interface InvestmentSummary {
  totalInvested: number;
  realizedPL: number;
  marketValue: number | null;
  unrealizedPL: number | null;
}

@Injectable()
export class InvestmentsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createTrade(userId: string, dto: CreateTradeDto): Promise<Trade> {
    if (dto.side === 'buy' || dto.side === 'sell') {
      if (dto.fundingAccountId === dto.accountId) {
        throw new BadRequestException({
          message: 'Funding account and investment account must be different.',
          code: 'SAME_ACCOUNT',
        });
      }
    }

    const amount = round2(dto.units * dto.price);
    const fee = round2(dto.fee ?? 0);

    const result = await this.db.transaction(async (tx) => {
      if (dto.side === 'buy' || dto.side === 'sell') {
        const [tradeRow] = await tx
          .insert(trades)
          .values({
            userId,
            accountId: dto.accountId,
            date: dto.date,
            security: dto.security,
            side: dto.side,
            units: dto.units,
            price: dto.price,
            amount,
            fee,
            notes: dto.notes ?? null,
          })
          .returning();

        const txFingerprint = computeFingerprint({
          type: 'investment',
          date: dto.date,
          merchant: dto.security,
          amount,
        });

        const [txRow] = await tx
          .insert(transactions)
          .values({
            userId,
            date: dto.date,
            merchant: dto.security,
            category: 'Investments',
            amount,
            type: 'investment',
            fromAccount: dto.fundingAccountId,
            toAccount: dto.accountId,
            side: dto.side,
            notes: dto.notes ?? null,
            source: 'manual',
            fingerprint: txFingerprint,
          })
          .returning();

        await tx
          .update(trades)
          .set({ linkedTransactionId: txRow.id })
          .where(eq(trades.id, tradeRow.id));

        return tradeRow;
      }

      const txFingerprint = computeFingerprint({
        type: 'investment',
        date: dto.date,
        merchant: dto.security,
        amount,
      });

      const [txRow] = await tx
        .insert(transactions)
        .values({
          userId,
          date: dto.date,
          merchant: dto.security,
          category: 'Investments',
          amount,
          type: 'investment',
          fromAccount: dto.fundingAccountId,
          side: dto.side,
          notes: dto.notes ?? null,
          source: 'manual',
          fingerprint: txFingerprint,
        })
        .returning();

      const [tradeRow] = await tx
        .insert(trades)
        .values({
          userId,
          accountId: dto.accountId,
          date: dto.date,
          security: dto.security,
          side: dto.side,
          units: dto.units,
          price: dto.price,
          amount,
          fee,
          linkedTransactionId: txRow.id,
          notes: dto.notes ?? null,
        })
        .returning();

      return tradeRow;
    });

    return result;
  }

  async getTrades(userId: string, query: TradeQueryDto): Promise<Trade[]> {
    const conditions: SQL[] = [eq(trades.userId, userId)];
    if (query.accountId) {
      conditions.push(eq(trades.accountId, query.accountId));
    }
    if (query.security) {
      conditions.push(eq(trades.security, query.security));
    }

    return this.db
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.date), desc(trades.createdAt));
  }

  async getPositions(
    userId: string,
    query: PositionQueryDto,
  ): Promise<Position[]> {
    const conditions: SQL[] = [eq(trades.userId, userId)];
    if (query.accountId) {
      conditions.push(eq(trades.accountId, query.accountId));
    }

    const rows = await this.db
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(asc(trades.security), asc(trades.date));

    const holdings = new Map<
      string,
      { units: number; totalCost: number; realizedPL: number }
    >();

    for (const row of rows) {
      const key = row.security;
      const existing = holdings.get(key) ?? {
        units: 0,
        totalCost: 0,
        realizedPL: 0,
      };

      if (row.side === 'buy') {
        existing.totalCost += row.amount + row.fee;
        existing.units += row.units;
      } else if (row.side === 'sell') {
        const avgCost =
          existing.units > 0 ? existing.totalCost / existing.units : 0;
        const costOfSold = avgCost * row.units;
        existing.realizedPL += row.amount - row.fee - costOfSold;
        existing.units -= row.units;
        if (existing.units < 0.0001) {
          existing.units = 0;
          existing.totalCost = 0;
        } else {
          existing.totalCost -= costOfSold;
        }
      } else if (row.side === 'dividend' || row.side === 'interest') {
        existing.realizedPL += row.amount;
      }

      holdings.set(key, existing);
    }

    const positions: Position[] = [];
    for (const [security, holding] of holdings) {
      if (holding.units < 0.0001) {
        continue;
      }
      const avgCost = round4(holding.totalCost / holding.units);
      const costBasis = round2(holding.totalCost);

      const [secRow] = await this.db
        .select()
        .from(securities)
        .where(
          and(eq(securities.userId, userId), eq(securities.name, security)),
        )
        .limit(1);

      const currentPrice = secRow?.currentPrice ?? null;
      const marketValue =
        currentPrice !== null ? round2(holding.units * currentPrice) : null;
      const unrealizedPL =
        marketValue !== null ? round2(marketValue - costBasis) : null;

      positions.push({
        security,
        units: round4(holding.units),
        avgCost,
        costBasis,
        currentPrice,
        marketValue,
        unrealizedPL,
      });
    }

    return positions;
  }

  async getSummary(
    userId: string,
    accountId?: string,
  ): Promise<InvestmentSummary> {
    const conditions: SQL[] = [eq(trades.userId, userId)];
    if (accountId) {
      conditions.push(eq(trades.accountId, accountId));
    }

    const rows = await this.db
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(asc(trades.security), asc(trades.date));

    let totalInvested = 0;
    let realizedPL = 0;

    const holdings = new Map<string, { units: number; totalCost: number }>();

    for (const row of rows) {
      const key = row.security;
      const existing = holdings.get(key) ?? { units: 0, totalCost: 0 };

      if (row.side === 'buy') {
        totalInvested += row.amount + row.fee;
        existing.totalCost += row.amount + row.fee;
        existing.units += row.units;
      } else if (row.side === 'sell') {
        const avgCost =
          existing.units > 0 ? existing.totalCost / existing.units : 0;
        const costOfSold = avgCost * row.units;
        realizedPL += row.amount - row.fee - costOfSold;
        existing.units -= row.units;
        if (existing.units < 0.0001) {
          existing.units = 0;
          existing.totalCost = 0;
        } else {
          existing.totalCost -= costOfSold;
        }
      } else if (row.side === 'dividend' || row.side === 'interest') {
        realizedPL += row.amount;
      }

      holdings.set(key, existing);
    }

    let marketValueTotal = 0;
    let totalCost = 0;
    let hasMarketValue = false;

    for (const [security, holding] of holdings) {
      if (holding.units < 0.0001) {
        continue;
      }
      totalCost += holding.totalCost;

      const [secRow] = await this.db
        .select()
        .from(securities)
        .where(
          and(eq(securities.userId, userId), eq(securities.name, security)),
        )
        .limit(1);

      if (secRow?.currentPrice !== null && secRow?.currentPrice !== undefined) {
        marketValueTotal += holding.units * secRow.currentPrice;
        hasMarketValue = true;
      }
    }

    return {
      totalInvested: round2(totalInvested),
      realizedPL: round2(realizedPL),
      marketValue: hasMarketValue ? round2(marketValueTotal) : null,
      unrealizedPL: hasMarketValue
        ? round2(marketValueTotal - totalCost)
        : null,
    };
  }

  async updateSecurity(
    userId: string,
    name: string,
    dto: UpdateSecurityDto,
  ): Promise<{ name: string; currentPrice: number }> {
    const trimmed = name.trim();
    const [existing] = await this.db
      .select()
      .from(securities)
      .where(and(eq(securities.userId, userId), eq(securities.name, trimmed)))
      .limit(1);

    if (existing) {
      await this.db
        .update(securities)
        .set({ currentPrice: dto.currentPrice, updatedAt: new Date() })
        .where(
          and(eq(securities.userId, userId), eq(securities.name, trimmed)),
        );
    } else {
      await this.db.insert(securities).values({
        userId,
        name: trimmed,
        currentPrice: dto.currentPrice,
      });
    }

    return { name: trimmed, currentPrice: dto.currentPrice };
  }

  async getQuote(
    userId: string,
    query: QuoteQueryDto,
  ): Promise<{ symbol: string; price: number; source: string }> {
    const symbol = query.q.trim().toUpperCase();

    const [cached] = await this.db
      .select()
      .from(quotes)
      .where(eq(quotes.symbol, symbol))
      .limit(1);

    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < 5 * 60 * 1000) {
        return {
          symbol: cached.symbol,
          price: cached.price,
          source: cached.source,
        };
      }
    }

    const isMf = /^\d{6}$/.test(symbol);
    const source = isMf ? 'amfi' : 'yahoo';

    try {
      let price: number;
      if (isMf) {
        price = await this.fetchAmfiNav(symbol);
      } else {
        price = await this.fetchYahooPrice(symbol);
      }

      await this.db
        .insert(quotes)
        .values({ symbol, source, price })
        .onConflictDoUpdate({
          target: [quotes.symbol, quotes.source],
          set: { price, fetchedAt: new Date() },
        });

      await this.upsertSecurityPrice(userId, symbol, price);

      return { symbol, price, source };
    } catch {
      if (cached) {
        return {
          symbol: cached.symbol,
          price: cached.price,
          source: cached.source,
        };
      }
      throw new NotFoundException({
        message: `No quote available for "${query.q}".`,
        code: 'QUOTE_NOT_FOUND',
      });
    }
  }

  async refreshAllQuotes(
    userId: string,
  ): Promise<{ security: string; price: number; source: string }[]> {
    const rows = await this.db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId));

    const securitySet = new Set<string>();
    for (const row of rows) {
      if (row.side === 'buy' || row.side === 'sell') {
        securitySet.add(row.security);
      }
    }

    const results: { security: string; price: number; source: string }[] = [];
    for (const security of securitySet) {
      try {
        const result = await this.getQuote(userId, { q: security });
        results.push({ security, price: result.price, source: result.source });
      } catch {
        // skip failures silently
      }
    }
    return results;
  }

  async getAccountBalances(
    userId: string,
  ): Promise<
    Array<{ accountId: string; name: string; type: string; balance: number }>
  > {
    const allAccounts = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const allTx = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const balanceMap = new Map<string, number>();
    for (const acct of allAccounts) {
      balanceMap.set(acct.name, 0);
    }

    for (const tx of allTx) {
      switch (tx.type) {
        case 'income':
          if (tx.fromAccount) {
            balanceMap.set(
              tx.fromAccount,
              (balanceMap.get(tx.fromAccount) ?? 0) + tx.amount,
            );
          }
          break;
        case 'expense':
          if (tx.fromAccount) {
            balanceMap.set(
              tx.fromAccount,
              (balanceMap.get(tx.fromAccount) ?? 0) - tx.amount,
            );
          }
          break;
        case 'transfer':
        case 'investment':
          if (tx.fromAccount) {
            balanceMap.set(
              tx.fromAccount,
              (balanceMap.get(tx.fromAccount) ?? 0) - tx.amount,
            );
          }
          if (tx.toAccount) {
            balanceMap.set(
              tx.toAccount,
              (balanceMap.get(tx.toAccount) ?? 0) + tx.amount,
            );
          }
          break;
      }
    }

    const positions = await this.getPositions(userId, {});
    const securityPriceMap = new Map<string, number>();
    for (const pos of positions) {
      if (pos.currentPrice !== null) {
        securityPriceMap.set(pos.security, pos.currentPrice);
      }
    }

    return allAccounts.map((acct) => ({
      accountId: acct.id,
      name: acct.name,
      type: acct.type,
      balance:
        acct.type === 'investment'
          ? this.computeInvestmentBalance(
              acct.id,
              balanceMap.get(acct.name) ?? 0,
              securityPriceMap,
            )
          : (balanceMap.get(acct.name) ?? 0),
    }));
  }

  async getBackfillCandidates(userId: string): Promise<
    Array<{
      id: string;
      date: string;
      merchant: string;
      amount: number;
      fromAccount: string;
      category: string;
    }>
  > {
    const investmentNames = new Set<string>();
    const allTrades = await this.db
      .select({ security: trades.security })
      .from(trades)
      .where(eq(trades.userId, userId));
    for (const t of allTrades) {
      investmentNames.add(t.security.toLowerCase());
    }

    const expenseRows = await this.db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), eq(transactions.type, 'expense')),
      )
      .orderBy(desc(transactions.date));

    return expenseRows
      .filter((tx) => {
        const merchant = tx.merchant.toLowerCase();
        const category = tx.category.toLowerCase();
        return (
          investmentNames.has(merchant) ||
          investmentNames.has(category) ||
          category === 'investments'
        );
      })
      .map((tx) => ({
        id: tx.id,
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
        fromAccount: tx.fromAccount,
        category: tx.category,
      }));
  }

  async backfillTransaction(
    userId: string,
    transactionId: string,
    accountId: string,
  ): Promise<void> {
    const [tx] = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
        ),
      )
      .limit(1);

    if (!tx) {
      throw new NotFoundException({
        message: 'Transaction not found.',
        code: 'NOT_FOUND',
      });
    }
    if (tx.type !== 'expense') {
      throw new BadRequestException({
        message: 'Only expense transactions can be backfilled.',
        code: 'NOT_EXPENSE',
      });
    }

    const security = tx.merchant;
    const units = 1;
    const price = tx.amount;

    await this.db.transaction(async (dbTx) => {
      await dbTx
        .update(transactions)
        .set({
          type: 'investment',
          toAccount: accountId,
          side: 'buy',
        })
        .where(eq(transactions.id, transactionId));

      await dbTx.insert(trades).values({
        userId,
        accountId,
        date: tx.date,
        security,
        side: 'buy',
        units,
        price,
        amount: tx.amount,
        fee: 0,
        linkedTransactionId: transactionId,
      });
    });
  }

  private async upsertSecurityPrice(
    userId: string,
    securityName: string,
    price: number,
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(securities)
      .where(
        and(eq(securities.userId, userId), eq(securities.name, securityName)),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(securities)
        .set({ currentPrice: price, updatedAt: new Date() })
        .where(
          and(eq(securities.userId, userId), eq(securities.name, securityName)),
        );
    } else {
      await this.db.insert(securities).values({
        userId,
        name: securityName,
        currentPrice: price,
      });
    }
  }

  private computeInvestmentBalance(
    _accountId: string,
    _cashBalance: number,
    securityPriceMap: Map<string, number>,
  ): number {
    return 0;
  }

  private async fetchYahooPrice(symbol: string): Promise<number> {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Yahoo API returned ${res.status}`);
    }

    const data = (await res.json()) as YahooChartResponse;
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price !== 'number' || price <= 0) {
      throw new Error('No price in Yahoo response');
    }
    return price;
  }

  private async fetchAmfiNav(schemeCode: string): Promise<number> {
    const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
    if (!res.ok) {
      throw new Error(`AMFI API returned ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length >= 5 && parts[0].trim() === schemeCode) {
        const nav = parseFloat(parts[4].trim());
        if (!Number.isNaN(nav) && nav > 0) {
          return nav;
        }
      }
    }
    throw new Error(`Scheme code ${schemeCode} not found in AMFI data`);
  }
}
