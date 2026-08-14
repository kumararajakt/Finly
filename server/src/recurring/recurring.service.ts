import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  recurring,
  type NewRecurring,
  type Recurring,
} from '../database/schema';
import { CreateRecurringDto, UpdateRecurringDto } from './recurring.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Recurring payment not found.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class RecurringService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string): Promise<Recurring[]> {
    return this.db
      .select()
      .from(recurring)
      .where(eq(recurring.userId, userId))
      .orderBy(asc(recurring.nextDate), asc(recurring.name));
  }

  async create(userId: string, dto: CreateRecurringDto): Promise<Recurring> {
    const values: NewRecurring = {
      userId,
      name: dto.name.trim(),
      category: dto.category.trim(),
      amount: round2(dto.amount),
      cadence: dto.cadence,
      nextDate: dto.nextDate,
      account: dto.account?.trim() || null,
      active: dto.active ?? true,
    };
    const [row] = await this.db.insert(recurring).values(values).returning();
    return row;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringDto,
  ): Promise<Recurring> {
    const existing = await this.db
      .select()
      .from(recurring)
      .where(and(eq(recurring.id, id), eq(recurring.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw notFound();
    }
    const current = existing[0];
    const [row] = await this.db
      .update(recurring)
      .set({
        name: dto.name !== undefined ? dto.name.trim() : current.name,
        category:
          dto.category !== undefined ? dto.category.trim() : current.category,
        amount: dto.amount !== undefined ? round2(dto.amount) : current.amount,
        cadence: dto.cadence ?? current.cadence,
        nextDate: dto.nextDate ?? current.nextDate,
        account:
          dto.account !== undefined
            ? dto.account.trim() || null
            : current.account,
        active: dto.active ?? current.active,
      })
      .where(and(eq(recurring.id, id), eq(recurring.userId, userId)))
      .returning();
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(recurring)
      .where(and(eq(recurring.id, id), eq(recurring.userId, userId)))
      .returning({ id: recurring.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
