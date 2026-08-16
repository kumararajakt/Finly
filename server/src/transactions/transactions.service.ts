import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  arrayContains,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  transactions,
  type NewTransaction,
  type Transaction,
} from '../database/schema';
import { computeFingerprint } from '../common/fingerprint';
import { periodRange, type DateRange } from '../summary/period';
import { SettingsService } from '../settings/settings.service';
import {
  CreateTransactionDto,
  TransactionQueryDto,
  UpdateTransactionDto,
} from './transactions.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  return [
    ...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  ];
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (
      typeof current === 'object' &&
      (current as { code?: string }).code === '23505'
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function duplicateError(): ConflictException {
  return new ConflictException({
    message:
      'A transaction with the same date, merchant, amount, and type already exists.',
    code: 'DUPLICATE_TRANSACTION',
  });
}

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly settingsService: SettingsService,
  ) {}

  async list(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<Transaction[]> {
    const conditions: SQL[] = [eq(transactions.userId, userId)];
    if (query.period) {
      const range =
        query.period === 'custom'
          ? await this.customRange(userId)
          : periodRange(query.period);
      if (range.start) {
        conditions.push(gte(transactions.date, range.start));
      }
      conditions.push(lte(transactions.date, range.end));
    }
    if (query.account) {
      conditions.push(eq(transactions.account, query.account));
    }
    if (query.category) {
      conditions.push(eq(transactions.category, query.category));
    }
    if (query.search) {
      const needle = `%${query.search}%`;
      conditions.push(
        or(
          ilike(transactions.merchant, needle),
          ilike(transactions.category, needle),
          sql`${transactions.tags}::text ilike ${needle}`,
        )!,
      );
    }
    if (query.type) {
      conditions.push(eq(transactions.type, query.type));
    }
    if (query.tag) {
      conditions.push(arrayContains(transactions.tags, [query.tag]));
    }
    if (query.dateFrom) {
      conditions.push(gte(transactions.date, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(transactions.date, query.dateTo));
    }
    if (query.minAmount !== undefined) {
      conditions.push(gte(transactions.amount, query.minAmount));
    }
    if (query.maxAmount !== undefined) {
      conditions.push(lte(transactions.amount, query.maxAmount));
    }
    if (query.receipt) {
      conditions.push(eq(transactions.receipt, query.receipt === 'true'));
    }

    return this.db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
  }

  private async customRange(userId: string): Promise<DateRange> {
    const settings = await this.settingsService.getAll(userId);
    return periodRange('custom', new Date(), {
      start: settings.customDateFrom,
      end: settings.customDateTo,
    });
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const values: NewTransaction = {
      userId,
      date: dto.date,
      merchant: dto.merchant.trim(),
      category: dto.category?.trim() || 'Needs review',
      amount: round2(dto.amount),
      type: dto.type,
      account: dto.account?.trim() || 'Imported account',
      tags: normalizeTags(dto.tags),
      notes: dto.notes?.trim() || null,
      receipt: dto.receipt ?? false,
      source: 'manual',
      fingerprint: computeFingerprint({
        type: dto.type,
        date: dto.date,
        merchant: dto.merchant,
        amount: dto.amount,
      }),
    };

    try {
      const [row] = await this.db
        .insert(transactions)
        .values(values)
        .returning();
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateError();
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const existing = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw new NotFoundException({
        message: 'Transaction not found.',
        code: 'NOT_FOUND',
      });
    }
    const current = existing[0];

    const merged = {
      date: dto.date ?? current.date,
      merchant:
        dto.merchant !== undefined ? dto.merchant.trim() : current.merchant,
      category:
        dto.category !== undefined ? dto.category.trim() : current.category,
      amount: dto.amount !== undefined ? round2(dto.amount) : current.amount,
      type: dto.type ?? current.type,
      account: dto.account !== undefined ? dto.account.trim() : current.account,
      tags: dto.tags !== undefined ? normalizeTags(dto.tags) : current.tags,
      notes: dto.notes !== undefined ? dto.notes.trim() || null : current.notes,
      receipt: current.receipt,
      source: current.source,
      fingerprint: computeFingerprint({
        type: dto.type ?? current.type,
        date: dto.date ?? current.date,
        merchant: dto.merchant ?? current.merchant,
        amount: dto.amount ?? current.amount,
      }),
    };

    try {
      const [row] = await this.db
        .update(transactions)
        .set(merged)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .returning();
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateError();
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    if (result.length === 0) {
      throw new NotFoundException({
        message: 'Transaction not found.',
        code: 'NOT_FOUND',
      });
    }
  }
}
