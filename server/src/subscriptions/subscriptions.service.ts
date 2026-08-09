import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type { Database } from '../database/database.module';
import {
  subscriptions,
  type NewSubscription,
  type Subscription,
} from '../database/schema';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './subscriptions.dto';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Subscription not found.',
    code: 'NOT_FOUND',
  });
}

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(): Promise<Subscription[]> {
    return this.db
      .select()
      .from(subscriptions)
      .orderBy(asc(subscriptions.nextRenewal), asc(subscriptions.name));
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const values: NewSubscription = {
      name: dto.name.trim(),
      category: dto.category.trim(),
      amount: round2(dto.amount),
      cadence: dto.cadence,
      nextRenewal: dto.nextRenewal,
      account: dto.account?.trim() || null,
      active: dto.active ?? true,
    };
    const [row] = await this.db
      .insert(subscriptions)
      .values(values)
      .returning();
    return row;
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (existing.length === 0) {
      throw notFound();
    }
    const current = existing[0];
    const [row] = await this.db
      .update(subscriptions)
      .set({
        name: dto.name !== undefined ? dto.name.trim() : current.name,
        category:
          dto.category !== undefined ? dto.category.trim() : current.category,
        amount: dto.amount !== undefined ? round2(dto.amount) : current.amount,
        cadence: dto.cadence ?? current.cadence,
        nextRenewal: dto.nextRenewal ?? current.nextRenewal,
        account:
          dto.account !== undefined
            ? dto.account.trim() || null
            : current.account,
        active: dto.active ?? current.active,
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return row;
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning({ id: subscriptions.id });
    if (result.length === 0) {
      throw notFound();
    }
  }
}
