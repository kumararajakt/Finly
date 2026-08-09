import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { recurring, subscriptions, transactions } from '../database/schema';
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
  duplicate: number;
  skipped: number;
  review: number;
}

export interface Summary {
  period: Period;
  netWorth: number | null;
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
  ) {}

  async getSummary(period?: Period): Promise<Summary> {
    const allSettings = await this.settingsService.getAll();
    const activePeriod = period ?? allSettings.selectedPeriod;
    const range = periodRange(activePeriod);

    const conditions: SQL[] = [];
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

    const netWorth = allSettings.netWorthConfigured
      ? round2(allSettings.totalAssets - allSettings.totalLiabilities)
      : null;

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

    return {
      period: activePeriod,
      netWorth,
      income,
      spending,
      savingsRate,
      cashFlow,
      categoryBreakdown,
      recentActivity,
      comingUp,
      needsReviewCount,
      pendingSuggestions: 0,
      lastImport,
    };
  }
}
