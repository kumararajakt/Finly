import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  accounts,
  recurring,
  subscriptions,
  transactions,
} from '../database/schema';
import { DetectionService } from '../detection/detection.service';
import { InvestmentsService } from '../investments/investments.service';
import type { Period } from '../settings/settings.types';
import { SettingsService } from '../settings/settings.service';
import { buildBuckets, periodRange, localDateISO } from './period';

export interface CashFlowPoint {
  label: string;
  income: number;
  spending: number;
}

export interface CategorySlice {
  category: string;
  amount: number;
  percentage: number;
}

export interface ComingUpItem {
  kind: 'recurring' | 'subscription';
  name: string;
  category: string;
  amount: number;
  date: string;
}

export interface ImportResult {
  inserted: number;
  duplicates: number;
  skipped: number;
  needsReview: number;
  totalRows: number;
}

export interface NetWorthBreakdown {
  cash: number;
  investments: number;
  credit: number;
  other: number;
}

export interface Summary {
  period: Period;
  netWorth: number;
  netWorthBreakdown: NetWorthBreakdown;
  income: number;
  spending: number;
  savingsRate: number;
  cashFlow: CashFlowPoint[];
  categoryBreakdown: CategorySlice[];
  recentActivity: (typeof transactions.$inferSelect)[];
  comingUp: ComingUpItem[];
  needsReviewCount: number;
  pendingSuggestions: number;
  lastImport: ImportResult | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class SummaryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly settingsService: SettingsService,
    private readonly detectionService: DetectionService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  async getSummary(userId: string, period?: Period): Promise<Summary> {
    const allSettings = await this.settingsService.getAll(userId);
    const activePeriod = period ?? allSettings.selectedPeriod;
    const range = periodRange(activePeriod, new Date(), {
      start: allSettings.customDateFrom,
      end: allSettings.customDateTo,
    });

    const conditions: SQL[] = [eq(transactions.userId, userId)];
    if (range.start) {
      conditions.push(gte(transactions.date, range.start));
    }
    conditions.push(lte(transactions.date, range.end));

    const rows = await this.db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date));

    const income = round2(
      rows
        .filter((row) => row.type === 'income')
        .reduce((sum, row) => sum + row.amount, 0),
    );
    const spending = round2(
      rows
        .filter((row) => row.type === 'expense')
        .reduce((sum, row) => sum + row.amount, 0),
    );
    const savingsRate =
      income > 0 ? round2(((income - spending) / income) * 100) : 0;

    const netWorthBreakdown = await this.computeNetWorth(userId, allSettings.netWorthAdjustment);
    const netWorth = round2(
      netWorthBreakdown.cash +
        netWorthBreakdown.investments +
        netWorthBreakdown.credit +
        netWorthBreakdown.other,
    );

    const buckets = buildBuckets(
      range,
      rows.map((row) => row.date),
    );
    const cashFlow = buckets.map((bucket) => {
      const inBucket = rows.filter(
        (row) => row.date >= bucket.start && row.date <= bucket.end,
      );
      return {
        label: bucket.label,
        income: round2(
          inBucket
            .filter((row) => row.type === 'income')
            .reduce((sum, row) => sum + row.amount, 0),
        ),
        spending: round2(
          inBucket
            .filter((row) => row.type === 'expense')
            .reduce((sum, row) => sum + row.amount, 0),
        ),
      };
    });

    const expensesByCategory = new Map<string, number>();
    for (const row of rows) {
      if (row.type !== 'expense') {
        continue;
      }
      expensesByCategory.set(
        row.category,
        (expensesByCategory.get(row.category) ?? 0) + row.amount,
      );
    }
    const categoryBreakdown = [...expensesByCategory.entries()]
      .map(([category, amount]) => ({
        category,
        amount: round2(amount),
        percentage: spending > 0 ? round2((amount / spending) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const recentActivity = rows.slice(0, 5);

    const needsReviewCount = rows.filter(
      (row) => row.category === 'Needs review',
    ).length;

    const today = localDateISO(new Date());
    const plusSeven = new Date();
    plusSeven.setDate(plusSeven.getDate() + 7);
    const comingUpRangeEnd = localDateISO(plusSeven);

    const [recurringRows, subscriptionRows] = await Promise.all([
      this.db
        .select()
        .from(recurring)
        .where(
          and(
            eq(recurring.userId, userId),
            eq(recurring.active, true),
            gte(recurring.nextDate, today),
            lte(recurring.nextDate, comingUpRangeEnd),
          ),
        )
        .orderBy(asc(recurring.nextDate)),
      this.db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.active, true),
            gte(subscriptions.nextRenewal, today),
            lte(subscriptions.nextRenewal, comingUpRangeEnd),
          ),
        )
        .orderBy(asc(subscriptions.nextRenewal)),
    ]);

    const comingUp: ComingUpItem[] = [
      ...recurringRows.map((row) => ({
        kind: 'recurring' as const,
        name: row.name,
        category: row.category,
        amount: row.amount,
        date: row.nextDate,
      })),
      ...subscriptionRows.map((row) => ({
        kind: 'subscription' as const,
        name: row.name,
        category: row.category,
        amount: row.amount,
        date: row.nextRenewal,
      })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const lastImport = null;

    const pendingSuggestions = (
      await this.detectionService.getSuggestions(userId)
    ).length;

    return {
      period: activePeriod,
      netWorth,
      netWorthBreakdown,
      income,
      spending,
      savingsRate,
      cashFlow,
      categoryBreakdown,
      recentActivity,
      comingUp,
      needsReviewCount,
      pendingSuggestions,
      lastImport,
    };
  }

  private async computeNetWorth(userId: string, netWorthAdjustment: number): Promise<NetWorthBreakdown> {
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
      const applyToAccount = (acctName: string, delta: number) => {
        balanceMap.set(acctName, (balanceMap.get(acctName) ?? 0) + delta);
      };

      switch (tx.type) {
        case 'income':
          applyToAccount(tx.fromAccount, tx.amount);
          break;
        case 'expense':
          applyToAccount(tx.fromAccount, -tx.amount);
          break;
        case 'transfer':
        case 'investment':
          if (tx.fromAccount) {
            applyToAccount(tx.fromAccount, -tx.amount);
          }
          if (tx.toAccount) {
            applyToAccount(tx.toAccount, tx.amount);
          }
          break;
      }
    }

    const accountTypeMap = new Map(allAccounts.map((a) => [a.name, a.type]));
    let cash = 0;
    let credit = 0;

    for (const [acctName, balance] of balanceMap) {
      const type = accountTypeMap.get(acctName) ?? 'cash';
      if (type === 'credit') {
        credit += Math.max(0, -balance);
      } else if (type !== 'investment') {
        cash += balance;
      }
    }

    const positions = await this.investmentsService.getPositions(userId, {});
    const investments = positions.reduce(
      (sum, p) => sum + (p.marketValue ?? p.costBasis),
      0,
    );

    const other = netWorthAdjustment;

    return { cash, investments, credit, other };
  }
}
