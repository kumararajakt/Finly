import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from './database.constants';
import type { Database } from './database.module';
import { categories, settings } from './schema';

const DEFAULT_SETTINGS: { key: string; value: string }[] = [
  { key: 'selectedPeriod', value: 'all-time' },
  { key: 'netWorthAdjustment', value: '0' },
  { key: 'currency', value: 'USD' },
  { key: 'density', value: 'comfortable' },
  { key: 'dismissedPatterns', value: '[]' },
];

const STARTER_CATEGORIES = [
  'Housing',
  'Groceries',
  'Shopping',
  'Dining',
  'Transportation',
  'Utilities',
  'Subscriptions',
  'Insurance',
  'Health',
  'Entertainment',
  'Income',
  'Needs review',
  'Other',
];

@Injectable()
export class DatabaseSeedService {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async seedUserDefaults(userId: string): Promise<void> {
    await this.seedSettings(userId);
    await this.seedCategories(userId);
  }

  private async seedSettings(userId: string): Promise<void> {
    if (DEFAULT_SETTINGS.length === 0) {
      return;
    }
    await this.db
      .insert(settings)
      .values(DEFAULT_SETTINGS.map((row) => ({ userId, ...row })))
      .onConflictDoNothing();
  }

  private async seedCategories(userId: string): Promise<void> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(eq(categories.userId, userId));

    if (count > 0) {
      return;
    }

    await this.db
      .insert(categories)
      .values(STARTER_CATEGORIES.map((name) => ({ userId, name })));
    this.logger.log(
      `Seeded ${STARTER_CATEGORIES.length} starter categories for user ${userId}`,
    );
  }
}
