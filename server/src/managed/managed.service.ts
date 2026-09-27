import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
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
  type AccountType,
  type Category,
} from '../database/schema';

export interface TagWithCount {
  name: string;
  count: number;
}

/** Every place a category name is stored as a plain TEXT label. */
export interface CategoryUsage {
  name: string;
  transactions: number;
  recurring: number;
  subscriptions: number;
  budgets: number;
}

type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

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

function usageTotal(usage: CategoryUsage): number {
  return (
    usage.transactions + usage.recurring + usage.subscriptions + usage.budgets
  );
}

const USAGE_LABELS: {
  key: Exclude<keyof CategoryUsage, 'name'>;
  label: string;
}[] = [
  { key: 'transactions', label: 'transaction' },
  { key: 'recurring', label: 'recurring payment' },
  { key: 'subscriptions', label: 'subscription' },
  { key: 'budgets', label: 'budget' },
];

function describeUsage(usage: CategoryUsage): string {
  const parts = USAGE_LABELS.filter(({ key }) => usage[key] > 0).map(
    ({ key, label }) => `${usage[key]} ${label}${usage[key] === 1 ? '' : 's'}`,
  );
  return `Category "${usage.name}" is used by ${parts.join(', ')}`;
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
        await this.reassignCategoryLabel(tx, userId, current.name, trimmed);
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

  /**
   * Reports which records still point at a category, so the client can ask for a
   * replacement category before allowing the delete.
   */
  async getCategoryUsage(userId: string, id: string): Promise<CategoryUsage> {
    const cat = await this.findCategory(userId, id);
    return this.countUsage(userId, cat.name);
  }

  /**
   * Deletes a category. Because transactions (and budgets/recurring/subscriptions)
   * store the category as a plain label, a category that is still in use can only be
   * removed by passing `moveTo` — the name of an existing category to merge into, or
   * a new name to create. Every referencing row is moved first, in one transaction.
   */
  async deleteCategory(
    userId: string,
    id: string,
    moveTo?: string,
  ): Promise<void> {
    const cat = await this.findCategory(userId, id);
    const usage = await this.countUsage(userId, cat.name);

    if (usageTotal(usage) === 0) {
      await this.db
        .delete(categories)
        .where(and(eq(categories.id, id), eq(categories.userId, userId)));
      return;
    }

    if (!moveTo) {
      throw new ConflictException({
        message: `${describeUsage(usage)} — choose another category to move them to before deleting "${cat.name}".`,
        code: 'CATEGORY_IN_USE',
      });
    }

    const target = moveTo.trim();
    if (target.toLowerCase() === cat.name.toLowerCase()) {
      throw new BadRequestException({
        message: `"${target}" is the category you are deleting. Choose a different category.`,
        code: 'MOVE_TO_SAME_CATEGORY',
      });
    }

    try {
      await this.db.transaction(async (tx) => {
        const targetName = await this.resolveMoveTarget(tx, userId, target);
        await this.reassignCategoryLabel(tx, userId, cat.name, targetName);
        await tx
          .delete(categories)
          .where(and(eq(categories.id, id), eq(categories.userId, userId)));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `A category named "${target}" already exists.`,
          code: 'DUPLICATE_CATEGORY',
        });
      }
      throw error;
    }
  }

  private async findCategory(userId: string, id: string): Promise<Category> {
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) {
      throw notFound('Category');
    }
    return cat;
  }

  private async countUsage(
    userId: string,
    name: string,
  ): Promise<CategoryUsage> {
    type LabeledTable =
      | typeof transactions
      | typeof recurring
      | typeof subscriptions
      | typeof budgets;
    const countFor = (table: LabeledTable) =>
      this.db
        .select({ n: count() })
        .from(table)
        .where(and(eq(table.userId, userId), eq(table.category, name)));
    const [[tx], [rec], [sub], [bud]] = await Promise.all([
      countFor(transactions),
      countFor(recurring),
      countFor(subscriptions),
      countFor(budgets),
    ]);
    return {
      name,
      transactions: tx?.n ?? 0,
      recurring: rec?.n ?? 0,
      subscriptions: sub?.n ?? 0,
      budgets: bud?.n ?? 0,
    };
  }

  /** Reuses an existing category with a case-insensitive match, otherwise creates one. */
  private async resolveMoveTarget(
    tx: DbTransaction,
    userId: string,
    target: string,
  ): Promise<string> {
    const [existing] = await tx
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          sql`lower(trim(${categories.name})) = lower(trim(${target}))`,
        ),
      )
      .limit(1);
    if (existing) {
      return existing.name;
    }
    await tx.insert(categories).values({ userId, name: target });
    return target;
  }

  private async reassignCategoryLabel(
    tx: DbTransaction,
    userId: string,
    from: string,
    to: string,
  ): Promise<void> {
    await Promise.all([
      tx
        .update(transactions)
        .set({ category: to })
        .where(
          and(eq(transactions.userId, userId), eq(transactions.category, from)),
        ),
      tx
        .update(recurring)
        .set({ category: to })
        .where(and(eq(recurring.userId, userId), eq(recurring.category, from))),
      tx
        .update(subscriptions)
        .set({ category: to })
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.category, from),
          ),
        ),
      tx
        .update(budgets)
        .set({ category: to })
        .where(and(eq(budgets.userId, userId), eq(budgets.category, from))),
    ]);
  }

  async listAccounts(userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.name);
  }

  async createAccount(
    userId: string,
    name: string,
    type?: AccountType,
  ): Promise<Account> {
    const trimmed = name.trim();
    try {
      const [row] = await this.db
        .insert(accounts)
        .values({ userId, name: trimmed, type: type ?? 'cash' })
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

  async updateAccount(
    userId: string,
    id: string,
    patch: { name?: string; type?: AccountType },
  ): Promise<Account> {
    const existing = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1);
    if (existing.length === 0) {
      throw notFound('Account');
    }

    const current = existing[0];
    const trimmed = patch.name?.trim();
    const newName = trimmed ?? current.name;
    const newType = patch.type ?? current.type;

    if (current.name === newName && current.type === newType) {
      return current;
    }

    try {
      const [row] = await this.db
        .update(accounts)
        .set({ name: newName, type: newType })
        .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
        .returning();
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `An account named "${newName}" already exists.`,
          code: 'DUPLICATE_ACCOUNT',
        });
      }
      throw error;
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
