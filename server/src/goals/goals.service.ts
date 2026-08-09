import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { goals, type Goal, type NewGoal } from '../database/schema';
import { CreateGoalDto, UpdateGoalDto } from './goals.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Goal not found.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class GoalsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(): Promise<Goal[]> {
    return this.db.select().from(goals).orderBy(asc(goals.createdAt));
  }

  async create(dto: CreateGoalDto): Promise<Goal> {
    const values: NewGoal = {
      name: dto.name.trim(),
      targetAmount: round2(dto.targetAmount),
      currentAmount:
        dto.currentAmount !== undefined ? round2(dto.currentAmount) : 0,
      dueDate: dto.dueDate ?? null,
      note: dto.note?.trim() || null,
    };
    const [row] = await this.db.insert(goals).values(values).returning();
    return row;
  }

  async update(id: string, dto: UpdateGoalDto): Promise<Goal> {
    const existing = await this.db
      .select()
      .from(goals)
      .where(eq(goals.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw notFound();
    }
    const current = existing[0];
    const [row] = await this.db
      .update(goals)
      .set({
        name: dto.name !== undefined ? dto.name.trim() : current.name,
        targetAmount:
          dto.targetAmount !== undefined
            ? round2(dto.targetAmount)
            : current.targetAmount,
        currentAmount:
          dto.currentAmount !== undefined
            ? round2(dto.currentAmount)
            : current.currentAmount,
        dueDate: dto.dueDate !== undefined ? dto.dueDate : current.dueDate,
        note: dto.note !== undefined ? dto.note?.trim() || null : current.note,
      })
      .where(eq(goals.id, id))
      .returning();
    return row;
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(goals)
      .where(eq(goals.id, id))
      .returning({ id: goals.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
