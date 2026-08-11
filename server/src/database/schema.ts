import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export type IsoDate = string & { readonly __isoDate?: never };

const isoDate = (name: string) => text(name).$type<IsoDate>();

export type Cadence =
  'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
export type TransactionType = 'expense' | 'income';
export type TransactionSource = 'manual' | 'csv' | 'document' | 'google-drive';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  country: text('country'),
  timeZone: text('time_zone'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: isoDate('date').notNull(),
    merchant: text('merchant').notNull(),
    category: text('category').notNull().default('Needs review'),
    amount: real('amount').notNull(),
    type: text('type').notNull().$type<TransactionType>(),
    account: text('account').notNull().default('Imported account'),
    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text('notes'),
    receipt: boolean('receipt').notNull().default(false),
    source: text('source')
      .notNull()
      .default('manual')
      .$type<TransactionSource>(),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('transactions_fingerprint_unique').on(table.fingerprint),
    index('transactions_date_idx').on(table.date),
    index('transactions_category_idx').on(table.category),
    index('transactions_account_idx').on(table.account),
    index('transactions_type_idx').on(table.type),
    index('transactions_tags_idx').using('gin', table.tags),
    check(
      'transactions_type_check',
      sql`${table.type} in ('expense', 'income')`,
    ),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('categories_name_unique').on(sql`lower(trim(${table.name}))`),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('accounts_name_unique').on(sql`lower(trim(${table.name}))`),
  ],
);

export const tags = pgTable('tags', {
  name: text('name').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rules = pgTable('rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  whenText: text('when_text').notNull(),
  thenText: text('then_text').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recurring = pgTable(
  'recurring',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    amount: real('amount').notNull(),
    cadence: text('cadence').notNull().$type<Cadence>(),
    nextDate: isoDate('next_date').notNull(),
    account: text('account'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('recurring_name_idx').on(table.name),
    check(
      'recurring_cadence_check',
      sql`${table.cadence} in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')`,
    ),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    amount: real('amount').notNull(),
    cadence: text('cadence').notNull().$type<Cadence>(),
    nextRenewal: isoDate('next_renewal').notNull(),
    account: text('account'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('subscriptions_name_idx').on(table.name),
    check(
      'subscriptions_cadence_check',
      sql`${table.cadence} in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')`,
    ),
  ],
);

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull(),
  monthlyLimit: real('monthly_limit').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').notNull().default(0),
  dueDate: isoDate('due_date'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type Recurring = typeof recurring.$inferSelect;
export type NewRecurring = typeof recurring.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
