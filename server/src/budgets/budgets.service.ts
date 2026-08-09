import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { budgets, type Budget, type NewBudget } from '../database/schema';
import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';

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

  async list(): Promise<Budget[]> {
    return this.db.select().from(budgets).orderBy(asc(budgets.category));
  }

  async create(dto: CreateBudgetDto): Promise<Budget> {
    const values: NewBudget = {
      category: dto.category.trim(),
      monthlyLimit: round2(dto.monthlyLimit),
      active: dto.active ?? true,
    };
    const [row] = await this.db.insert(budgets).values(values).returning();
    return row;
  }

  async update(id: string, dto: UpdateBudgetDto): Promise<Budget> {
    const existing = await this.db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id))
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
      .where(eq(budgets.id, id))
      .returning();
    return row;
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(budgets)
      .where(eq(budgets.id, id))
      .returning({ id: budgets.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
