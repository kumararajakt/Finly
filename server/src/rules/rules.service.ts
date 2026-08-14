import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { rules, type NewRule, type Rule } from '../database/schema';
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Rule not found.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class RulesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string): Promise<Rule[]> {
    return this.db
      .select()
      .from(rules)
      .where(eq(rules.userId, userId))
      .orderBy(asc(rules.createdAt));
  }

  async create(userId: string, dto: CreateRuleDto): Promise<Rule> {
    const values: NewRule = {
      userId,
      whenText: dto.whenText.trim(),
      thenText: dto.thenText.trim(),
      enabled: dto.enabled ?? true,
    };
    const [row] = await this.db.insert(rules).values(values).returning();
    return row;
  }

  async update(userId: string, id: string, dto: UpdateRuleDto): Promise<Rule> {
    const existing = await this.db
      .select()
      .from(rules)
      .where(and(eq(rules.id, id), eq(rules.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw notFound();
    }
    const current = existing[0];
    const [row] = await this.db
      .update(rules)
      .set({
        whenText:
          dto.whenText !== undefined ? dto.whenText.trim() : current.whenText,
        thenText:
          dto.thenText !== undefined ? dto.thenText.trim() : current.thenText,
        enabled: dto.enabled ?? current.enabled,
      })
      .where(and(eq(rules.id, id), eq(rules.userId, userId)))
      .returning();
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.userId, userId)))
      .returning({ id: rules.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
