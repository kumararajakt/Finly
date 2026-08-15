import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  accounts,
  budgets,
  categories,
  recurring,
  subscriptions,
  tags,
  transactions,
  type Account,
  type Category,
} from '../database/schema';

export interface TagWithCount {
  name: string;
  count: number;
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

function notFound(resource: string): NotFoundException {
  return new NotFoundException({
    message: `${resource} not found.`,
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class ManagedService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listCategories(userId: string): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.name);
  }

  async createCategory(userId: string, name: string): Promise<Category> {
    const trimmed = name.trim();
    try {
      const [row] = await this.db
        .insert(categories)
        .values({ userId, name: trimmed })
        .returning();
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `A category named "${trimmed}" already exists.`,
          code: 'DUPLICATE_CATEGORY',
        });
      }
      throw error;
    }
  }

  async renameCategory(
    userId: string,
    id: string,
    name: string,
  ): Promise<Category> {
    const trimmed = name.trim();
    const existing = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw notFound('Category');
    }
    const current = existing[0];
    if (current.name === trimmed) {
      return current;
    }
    try {
      const renamed = await this.db.transaction(async (tx) => {
        await Promise.all([
          tx
            .update(transactions)
            .set({ category: trimmed })
            .where(
              and(
                eq(transactions.userId, userId),
                eq(transactions.category, current.name),
              ),
            ),
          tx
            .update(recurring)
            .set({ category: trimmed })
            .where(
              and(
                eq(recurring.userId, userId),
                eq(recurring.category, current.name),
              ),
            ),
          tx
            .update(subscriptions)
            .set({ category: trimmed })
            .where(
              and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.category, current.name),
              ),
            ),
          tx
            .update(budgets)
            .set({ category: trimmed })
            .where(
              and(
                eq(budgets.userId, userId),
                eq(budgets.category, current.name),
              ),
            ),
        ]);
        const [row] = await tx
          .update(categories)
          .set({ name: trimmed })
          .where(and(eq(categories.id, id), eq(categories.userId, userId)))
          .returning();
        return row;
      });
      return renamed;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `A category named "${trimmed}" already exists.`,
          code: 'DUPLICATE_CATEGORY',
        });
      }
      throw error;
    }
  }

  async deleteCategory(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    if (result.length === 0) {
      throw notFound('Category');
    }
  }

  async listAccounts(userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.name);
  }

  async createAccount(userId: string, name: string): Promise<Account> {
    const trimmed = name.trim();
    try {
      const [row] = await this.db
        .insert(accounts)
        .values({ userId, name: trimmed })
        .returning();
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `An account named "${trimmed}" already exists.`,
          code: 'DUPLICATE_ACCOUNT',
        });
      }
      throw error;
    }
  }

  async deleteAccount(userId: string, id: string): Promise<void> {
    const result = await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning({ id: accounts.id });
    if (result.length === 0) {
      throw notFound('Account');
    }
  }

  async listTags(userId: string): Promise<TagWithCount[]> {
    const result = await this.db.execute(
      sql`
        select ${tags.name} as name, count(${transactions.id})::int as count
        from ${tags}
        left join ${transactions} on ${transactions.tags} @> jsonb_build_array(${tags.name})
          and ${transactions.userId} = ${tags.userId}
        where ${tags.userId} = ${userId}
        group by ${tags.name}
        order by lower(trim(${tags.name}))
      `,
    );
    return result.rows.map((row) => ({
      name: String(row.name),
      count: Number(row.count),
    }));
  }

  async createTag(userId: string, name: string): Promise<{ name: string }> {
    const trimmed = name.trim();
    const existing = await this.db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.userId, userId),
          sql`lower(trim(${tags.name})) = lower(trim(${trimmed}))`,
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException({
        message: `A tag named "${existing[0].name}" already exists.`,
        code: 'DUPLICATE_TAG',
      });
    }
    try {
      const [row] = await this.db
        .insert(tags)
        .values({ userId, name: trimmed })
        .returning();
      return { name: row.name };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `A tag named "${trimmed}" already exists.`,
          code: 'DUPLICATE_TAG',
        });
      }
      throw error;
    }
  }

  async deleteTag(userId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const result = await this.db
      .delete(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)))
      .returning({ name: tags.name });
    if (result.length === 0) {
      throw notFound('Tag');
    }
  }
}
