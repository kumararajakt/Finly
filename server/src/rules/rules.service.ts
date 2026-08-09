import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
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

  async list(): Promise<Rule[]> {
    return this.db.select().from(rules).orderBy(asc(rules.createdAt));
  }

  async create(dto: CreateRuleDto): Promise<Rule> {
    const values: NewRule = {
      whenText: dto.whenText.trim(),
      thenText: dto.thenText.trim(),
      enabled: dto.enabled ?? true,
    };
    const [row] = await this.db.insert(rules).values(values).returning();
    return row;
  }

  async update(id: string, dto: UpdateRuleDto): Promise<Rule> {
    const existing = await this.db
      .select()
      .from(rules)
      .where(eq(rules.id, id))
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
      .where(eq(rules.id, id))
      .returning();
    return row;
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(rules)
      .where(eq(rules.id, id))
      .returning({ id: rules.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
