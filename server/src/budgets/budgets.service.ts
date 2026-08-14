import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  budgets,
  transactions,
  type Budget,
  type NewBudget,
} from '../database/schema';
import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';
import { monthRange } from './month-range';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Budget not found.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class BudgetsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string): Promise<Budget[]> {
    return this.db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(asc(budgets.category));
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<Budget> {
    const values: NewBudget = {
      userId,
      category: dto.category.trim(),
      monthlyLimit: round2(dto.monthlyLimit),
      active: dto.active ?? true,
    };
    const [row] = await this.db.insert(budgets).values(values).returning();
    return row;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBudgetDto,
  ): Promise<Budget> {
    const existing = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw notFound();
    }
    const current = existing[0];
    const [row] = await this.db
      .update(budgets)
      .set({
        category:
          dto.category !== undefined ? dto.category.trim() : current.category,
        monthlyLimit:
          dto.monthlyLimit !== undefined
            ? round2(dto.monthlyLimit)
            : current.monthlyLimit,
        active: dto.active ?? current.active,
      })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });
    if (result.length === 0) {
      throw notFound();
    }
  }

  async spending(
    userId: string,
    month: string,
  ): Promise<Record<string, number>> {
    const { start, end } = monthRange(month);
    const rows = await this.db
      .select({
        category: transactions.category,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .groupBy(transactions.category);

    const totals: Record<string, number> = {};
    for (const row of rows) {
      totals[row.category] = round2(Number(row.total));
    }
    return totals;
  }
}
