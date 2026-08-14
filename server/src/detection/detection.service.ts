import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import { normalizeMerchant } from '../common/merchant';
import {
  recurring,
  subscriptions,
  transactions,
  type NewRecurring,
  type NewSubscription,
} from '../database/schema';
import { SettingsService } from '../settings/settings.service';
import { detectSuggestions } from './detection.algorithm';
import type { DetectionSuggestion } from './detection.types';

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Suggestion not found. It may already be kept or ignored.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class DetectionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly settingsService: SettingsService,
  ) {}

  async getSuggestions(userId: string): Promise<DetectionSuggestion[]> {
    const [expenses, recurringRows, subscriptionRows, allSettings] =
      await Promise.all([
        this.db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.type, 'expense'),
              eq(transactions.userId, userId),
            ),
          ),
        this.db.select().from(recurring).where(eq(recurring.userId, userId)),
        this.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId)),
        this.settingsService.getAll(userId),
      ]);

    const exclusions = new Set<string>(allSettings.dismissedPatterns);
    for (const row of [...recurringRows, ...subscriptionRows]) {
      const key = normalizeMerchant(row.name);
      if (key) {
        exclusions.add(key);
      }
    }

    return detectSuggestions(expenses, exclusions);
  }

  async keep(
    userId: string,
    key: string,
  ): Promise<{ kind: string; id: string; name: string }> {
    const suggestion = (await this.getSuggestions(userId)).find(
      (item) => item.key === key,
    );
    if (!suggestion) {
      throw notFound();
    }
    if (suggestion.kind === 'subscription') {
      const values: NewSubscription = {
        userId,
        name: suggestion.merchant,
        category: suggestion.category,
        amount: suggestion.averageAmount,
        cadence: suggestion.cadence,
        nextRenewal: suggestion.nextExpectedDate,
        account: suggestion.account,
        active: true,
      };
      const [row] = await this.db
        .insert(subscriptions)
        .values(values)
        .returning();
      return { kind: 'subscription', id: row.id, name: row.name };
    }
    const values: NewRecurring = {
      userId,
      name: suggestion.merchant,
      category: suggestion.category,
      amount: suggestion.averageAmount,
      cadence: suggestion.cadence,
      nextDate: suggestion.nextExpectedDate,
      account: suggestion.account,
      active: true,
    };
    const [row] = await this.db.insert(recurring).values(values).returning();
    return { kind: 'recurring', id: row.id, name: row.name };
  }

  async ignore(userId: string, key: string): Promise<{ success: true }> {
    const suggestion = (await this.getSuggestions(userId)).find(
      (item) => item.key === key,
    );
    if (!suggestion) {
      throw notFound();
    }
    const current = await this.settingsService.getAll(userId);
    const patterns = current.dismissedPatterns.includes(key)
      ? current.dismissedPatterns
      : [...current.dismissedPatterns, key];
    await this.settingsService.setValue(userId, 'dismissedPatterns', patterns);
    return { success: true };
  }
}
