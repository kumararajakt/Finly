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
  sessions,
  transactions,
  users,
  verification,
} from './../src/database/schema';
import { MailService } from './../src/mail/mail.service';

interface TransactionBody {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: string;
  account: string;
  tags: string[];
  receipt: boolean;
  source: string;
  fingerprint: string;
}

interface ErrorBody {
  error: { message: string; code: string };
}

class MailServiceStub {
  lastOtp: string | null = null;
  sendOtp = jest.fn((_to: string, otp: string) => {
    this.lastOtp = otp;
  });
}

describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let agent: ReturnType<typeof request.agent>;
  let mail: MailServiceStub;

  const validPassword = 'super-secret-password';
  const validEmail = 'txn@finly.local';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useClass(MailServiceStub)
      .compile();

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
    mail = moduleFixture.get(MailService);
    await db.delete(transactions);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email: validEmail, password: validPassword })
      .expect(202);
    await agent
      .post('/api/auth/register/verify')
      .send({
        email: validEmail,
        otp: mail.lastOtp,
        password: validPassword,
        confirmPassword: validPassword,
      })
      .expect(201);
  });

  afterAll(async () => {
    await db.delete(transactions);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app.getHttpServer()).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid UUID', async () => {
    const res = await agent.patch('/api/transactions/not-a-uuid').send({});
    expect(res.status).toBe(400);
  });

  it('validates create fields', async () => {
    const cases = [
      { date: '2024-01-05', merchant: 'Shop', amount: 0, type: 'expense' },
      { date: '2024-01-05', merchant: 'Shop', amount: -5, type: 'expense' },
      { date: '2024-01-05', merchant: 'Shop', amount: 10, type: 'transfer' },
      { date: '2024-13-99', merchant: 'Shop', amount: 10, type: 'expense' },
      { date: '2024-01-05', merchant: '', amount: 10, type: 'expense' },
    ];
    for (const body of cases) {
      const res = await agent.post('/api/transactions').send(body);
      expect(res.status).toBe(422);
    }
  });

  it('creates a transaction', async () => {
    const res = await agent.post('/api/transactions').send({
      date: '2024-01-05',
      merchant: 'Coffee Shop',
      category: 'Dining',
      amount: 5.5,
      type: 'expense',
      account: 'Checking',
      tags: ['daily'],
    });
    expect(res.status).toBe(201);
    const body = res.body as TransactionBody;
    expect(body).toMatchObject({
      date: '2024-01-05',
      merchant: 'Coffee Shop',
      category: 'Dining',
      amount: 5.5,
      type: 'expense',
      account: 'Checking',
      tags: ['daily'],
      receipt: false,
      source: 'manual',
    });
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.fingerprint).toHaveLength(64);
  });

  it('rejects a duplicate transaction', async () => {
    const duplicate = {
      date: '2024-01-05',
      merchant: 'Coffee Shop',
      amount: 5.5,
      type: 'expense',
    };
    const res = await agent.post('/api/transactions').send(duplicate);
    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error.code).toBe('DUPLICATE_TRANSACTION');
  });

  it('lists and filters transactions', async () => {
    await agent.post('/api/transactions').send({
      date: '2024-01-06',
      merchant: 'Acme Salary',
      category: 'Income',
      amount: 3000,
      type: 'income',
      account: 'Checking',
    });

    const all = await agent.get('/api/transactions');
    expect(all.status).toBe(200);
    expect((all.body as TransactionBody[]).length).toBe(2);

    const search = await agent.get('/api/transactions?search=coffee');
    expect((search.body as TransactionBody[]).length).toBe(1);
    expect((search.body as TransactionBody[])[0].merchant).toBe('Coffee Shop');

    const byCategory = await agent.get('/api/transactions?category=Income');
    expect((byCategory.body as TransactionBody[]).length).toBe(1);

    const byAccount = await agent.get('/api/transactions?account=Checking');
    expect((byAccount.body as TransactionBody[]).length).toBe(2);

    const invalidPeriod = await agent.get(
      '/api/transactions?period=not-a-period',
    );
    expect(invalidPeriod.status).toBe(422);
  });

  it('updates a transaction', async () => {
    const list = await agent.get('/api/transactions?search=coffee');
    const target = (list.body as TransactionBody[])[0];

    const res = await agent.patch(`/api/transactions/${target.id}`).send({
      merchant: 'Coffee Roasters',
      category: 'Shopping',
      tags: ['daily', 'reward'],
    });
    expect(res.status).toBe(200);
    expect(res.body as TransactionBody).toMatchObject({
      merchant: 'Coffee Roasters',
      category: 'Shopping',
      tags: ['daily', 'reward'],
    });
  });

  it('rejects an update that collides with an existing fingerprint', async () => {
    await agent.post('/api/transactions').send({
      date: '2024-01-07',
      merchant: 'Other Store',
      amount: 20,
      type: 'expense',
    });
    const target = await agent.get('/api/transactions?search=Roasters');
    const coffee = (target.body as TransactionBody[])[0];

    const res = await agent.patch(`/api/transactions/${coffee.id}`).send({
      date: '2024-01-07',
      merchant: 'Other Store',
      amount: 20,
    });
    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error.code).toBe('DUPLICATE_TRANSACTION');
  });

  it('returns 404 for a missing transaction on update', async () => {
    const res = await agent
      .patch('/api/transactions/00000000-0000-4000-8000-000000000000')
      .send({ category: 'Shopping' });
    expect(res.status).toBe(404);
  });

  it('deletes a transaction and returns 404 on repeat', async () => {
    const created = await agent.post('/api/transactions').send({
      date: '2024-01-08',
      merchant: 'Temporary',
      amount: 3,
      type: 'expense',
    });
    const id = (created.body as TransactionBody).id;

    const del = await agent.delete(`/api/transactions/${id}`);
    expect(del.status).toBe(204);

    const again = await agent.delete(`/api/transactions/${id}`);
    expect(again.status).toBe(404);
  });
});
