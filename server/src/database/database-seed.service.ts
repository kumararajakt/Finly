import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from './database.constants';
import type { Database } from './database.module';
import { categories, settings } from './schema';

const DEFAULT_SETTINGS: { key: string; value: string }[] = [
  { key: 'selectedPeriod', value: 'all-time' },
  { key: 'netWorthConfigured', value: 'false' },
  { key: 'totalAssets', value: '0' },
  { key: 'totalLiabilities', value: '0' },
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
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedSettings();
      await this.seedCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Database seeding skipped: ${message}`);
    }
  }

  private async seedSettings(): Promise<void> {
    if (DEFAULT_SETTINGS.length === 0) {
      return;
    }
    await this.db
      .insert(settings)
      .values(DEFAULT_SETTINGS)
      .onConflictDoNothing();
  }

  private async seedCategories(): Promise<void> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories);

    if (count > 0) {
      return;
    }

    await this.db
      .insert(categories)
      .values(STARTER_CATEGORIES.map((name) => ({ name })));
    this.logger.log(`Seeded ${STARTER_CATEGORIES.length} starter categories`);
  }
}
