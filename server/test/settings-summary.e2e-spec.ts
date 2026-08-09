import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { DRIZZLE } from './../src/database/database.constants';
import type { Database } from './../src/database/database.module';
import {
  account,
  recurring,
  sessions,
  settings,
  subscriptions,
  transactions,
  users,
  verification,
} from './../src/database/schema';

interface AuthErrorBody {
  error: { message: string; code: string };
}

interface SettingsBody {
  selectedPeriod: string;
  netWorthConfigured: boolean;
  totalAssets: number;
  totalLiabilities: number;
  currency: string;
  dismissedPatterns: string[];
  googleDriveFolderName: string | null;
}

interface CategorySlice {
  category: string;
  amount: number;
  percentage: number;
}

interface ComingUpItem {
  kind: 'recurring' | 'subscription';
  name: string;
  category: string;
  amount: number;
  date: string;
}

interface SummaryBody {
  period: string;
  netWorth: number | null;
  income: number;
  spending: number;
  savingsRate: number;
  categoryBreakdown: CategorySlice[];
  recentActivity: unknown[];
  comingUp: ComingUpItem[];
  needsReviewCount: number;
}

describe('Settings & Summary (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let agent: ReturnType<typeof request.agent>;

  const validPassword = 'super-secret-password';
  const validEmail = 'settings@finly.local';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    await app.init();

    db = moduleFixture.get<Database>(DRIZZLE);
    await db.delete(settings);
    await db.delete(recurring);
    await db.delete(subscriptions);
    await db.delete(transactions);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email: validEmail, password: validPassword })
      .expect(201);
  });

  afterAll(async () => {
    await db.delete(settings);
    await db.delete(recurring);
    await db.delete(subscriptions);
    await db.delete(transactions);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  describe('Settings', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(app.getHttpServer()).get('/api/settings');
      expect(res.status).toBe(401);
    });

    it('returns defaults for a fresh account', async () => {
      const res = await agent.get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body as SettingsBody).toMatchObject({
        selectedPeriod: 'all-time',
        netWorthConfigured: false,
        totalAssets: 0,
        totalLiabilities: 0,
        currency: 'USD',
        dismissedPatterns: [],
        googleDriveFolderName: null,
      });
    });

    it('upserts a single key without touching others', async () => {
      const res = await agent
        .put('/api/settings/selectedPeriod')
        .send({ value: 'this-month' });
      expect(res.status).toBe(200);
      expect((res.body as SettingsBody).selectedPeriod).toBe('this-month');

      const next = await agent
        .put('/api/settings/totalAssets')
        .send({ value: 12500 });
      expect(next.status).toBe(200);
      expect((next.body as SettingsBody).totalAssets).toBe(12500);
      expect((next.body as SettingsBody).selectedPeriod).toBe('this-month');
    });

    it('persists booleans', async () => {
      const res = await agent
        .put('/api/settings/netWorthConfigured')
        .send({ value: true });
      expect(res.status).toBe(200);
      expect((res.body as SettingsBody).netWorthConfigured).toBe(true);
    });

    it('rejects unknown keys', async () => {
      const res = await agent.put('/api/settings/bogusKey').send({ value: 1 });
      expect(res.status).toBe(404);
      expect((res.body as AuthErrorBody).error.code).toBe('UNKNOWN_SETTING');
    });

    it('rejects invalid values', async () => {
      const res = await agent
        .put('/api/settings/selectedPeriod')
        .send({ value: 'next-week' });
      expect(res.status).toBe(400);
      expect((res.body as AuthErrorBody).error.code).toBe('INVALID_SETTING');

      const negative = await agent
        .put('/api/settings/totalAssets')
        .send({ value: -5 });
      expect(negative.status).toBe(400);
    });
  });

  describe('Summary', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayISO = `${y}-${m}-${d}`;

    beforeAll(async () => {
      await db.insert(transactions).values([
        {
          date: todayISO,
          merchant: 'Acme Salary',
          category: 'Income',
          amount: 5000,
          type: 'income',
          account: 'Checking',
          tags: [],
          receipt: false,
          source: 'manual',
          fingerprint: 'e2e-salary',
        },
        {
          date: todayISO,
          merchant: 'Grocery Store',
          category: 'Groceries',
          amount: 250,
          type: 'expense',
          account: 'Checking',
          tags: [],
          receipt: false,
          source: 'manual',
          fingerprint: 'e2e-groceries',
        },
        {
          date: todayISO,
          merchant: 'Random Shop',
          category: 'Needs review',
          amount: 42.5,
          type: 'expense',
          account: 'Credit',
          tags: [],
          receipt: false,
          source: 'manual',
          fingerprint: 'e2e-review',
        },
      ]);
    });

    it('rejects unauthenticated access', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/summary?period=all-time',
      );
      expect(res.status).toBe(401);
    });

    it('rejects an invalid period', async () => {
      const res = await agent.get('/api/summary?period=nope');
      expect(res.status).toBe(422);
      expect((res.body as AuthErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('aggregates period totals', async () => {
      const res = await agent.get('/api/summary?period=all-time');
      expect(res.status).toBe(200);
      const body = res.body as SummaryBody;
      expect(body.period).toBe('all-time');
      expect(body.income).toBe(5000);
      expect(body.spending).toBe(292.5);
      expect(body.savingsRate).toBeCloseTo(94.15, 1);
      expect(body.needsReviewCount).toBe(1);
      expect(body.recentActivity).toHaveLength(3);
    });

    it('returns net worth from settings', async () => {
      await agent.put('/api/settings/netWorthConfigured').send({ value: true });
      await agent.put('/api/settings/totalAssets').send({ value: 12500 });
      await agent.put('/api/settings/totalLiabilities').send({ value: 2000 });

      const res = await agent.get('/api/summary?period=all-time');
      expect((res.body as SummaryBody).netWorth).toBe(10500);
    });

    it('builds category breakdown with percentages', async () => {
      const res = await agent.get('/api/summary?period=all-time');
      const groceries = (res.body as SummaryBody).categoryBreakdown.find(
        (c) => c.category === 'Groceries',
      );
      expect(groceries).toBeDefined();
      expect(groceries!.amount).toBe(250);
      expect(groceries!.percentage).toBeCloseTo(85.47, 1);
    });

    it('includes upcoming recurring and subscription items', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 3);
      const soonISO = `${soon.getFullYear()}-${String(
        soon.getMonth() + 1,
      ).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;

      await db.insert(recurring).values({
        name: 'Rent',
        category: 'Housing',
        amount: 1500,
        cadence: 'monthly',
        nextDate: soonISO,
        account: 'Checking',
        active: true,
      });
      await db.insert(subscriptions).values({
        name: 'Netflix',
        category: 'Subscriptions',
        amount: 15.99,
        cadence: 'monthly',
        nextRenewal: soonISO,
        account: 'Credit',
        active: true,
      });

      const res = await agent.get('/api/summary?period=all-time');
      expect((res.body as SummaryBody).comingUp).toHaveLength(2);
      const kinds = (res.body as SummaryBody).comingUp.map((c) => c.kind);
      expect(kinds).toContain('recurring');
      expect(kinds).toContain('subscription');
    });

    it('uses the saved selectedPeriod when none is passed', async () => {
      const res = await agent.get('/api/summary');
      expect((res.body as SummaryBody).period).toBe('this-month');
    });
  });
});
