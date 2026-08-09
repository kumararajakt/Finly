import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  accounts,
  categories,
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

  async listCategories(): Promise<Category[]> {
    return this.db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(name: string): Promise<Category> {
    const trimmed = name.trim();
    try {
      const [row] = await this.db
        .insert(categories)
        .values({ name: trimmed })
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

  async deleteCategory(id: string): Promise<void> {
    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    if (result.length === 0) {
      throw notFound('Category');
    }
  }

  async listAccounts(): Promise<Account[]> {
    return this.db.select().from(accounts).orderBy(accounts.name);
  }

  async createAccount(name: string): Promise<Account> {
    const trimmed = name.trim();
    try {
      const [row] = await this.db
        .insert(accounts)
        .values({ name: trimmed })
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

  async deleteAccount(id: string): Promise<void> {
    const result = await this.db
      .delete(accounts)
      .where(eq(accounts.id, id))
      .returning({ id: accounts.id });
    if (result.length === 0) {
      throw notFound('Account');
    }
  }

  async listTags(): Promise<TagWithCount[]> {
    const result = await this.db.execute(
      sql`
        select ${tags.name} as name, count(${transactions.id})::int as count
        from ${tags}
        left join ${transactions} on ${transactions.tags} @> jsonb_build_array(${tags.name})
        group by ${tags.name}
        order by lower(trim(${tags.name}))
      `,
    );
    return result.rows.map((row) => ({
      name: String(row.name),
      count: Number(row.count),
    }));
  }

  async createTag(name: string): Promise<{ name: string }> {
    const trimmed = name.trim();
    const existing = await this.db
      .select()
      .from(tags)
      .where(sql`lower(trim(${tags.name})) = lower(trim(${trimmed}))`)
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
        .values({ name: trimmed })
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

  async deleteTag(name: string): Promise<void> {
    const trimmed = name.trim();
    const result = await this.db
      .delete(tags)
      .where(eq(tags.name, trimmed))
      .returning({ name: tags.name });
    if (result.length === 0) {
      throw notFound('Tag');
    }
  }
}
