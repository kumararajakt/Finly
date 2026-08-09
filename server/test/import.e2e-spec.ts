import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { DRIZZLE } from './../src/database/database.constants';
import type { Database } from './../src/database/database.module';
import {
  account,
  accounts,
  sessions,
  transactions,
  users,
  verification,
} from './../src/database/schema';

interface CsvPreviewBody {
  headers: string[];
  columnCount: number;
  sampleRows: string[][];
  rowCount: number;
  hasHeader: boolean;
  mapping: { date: number; merchant: number; amount: number; category: number };
  dateOrder: string;
  ambiguous: string[];
}

interface CsvImportBody {
  inserted: number;
  duplicates: number;
  skipped: number;
  needsReview: number;
  totalRows: number;
}

interface ErrorBody {
  error: { message: string; code: string };
}

const STATEMENT = [
  'Date,Description,Amount,Category',
  '2024-01-05,Coffee,5.50,Dining',
  '2024-01-06,Gas,40.00,Automotive',
  '2024-01-05,Coffee,5.50,Dining',
  'not-a-date,Skips,10.00,Other',
  '2024-01-08,Paycheck,3000.00,Income',
].join('\n');

describe('CSV Import (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let agent: ReturnType<typeof request.agent>;

  const validPassword = 'super-secret-password';
  const validEmail = 'import@finly.local';

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
    await db.delete(transactions);
    await db.delete(accounts);
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
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(verification);
    await db.delete(account);
    await db.delete(sessions);
    await db.delete(users);
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/import/csv/preview')
      .send({ csv: 'a,b,c' });
    expect(res.status).toBe(401);
  });

  it('rejects an empty CSV', async () => {
    const res = await agent
      .post('/api/import/csv/preview')
      .send({ csv: '\n\n' });
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('INVALID_CSV');
  });

  it('previews columns, header row, and sample rows', async () => {
    const res = await agent
      .post('/api/import/csv/preview')
      .send({ csv: STATEMENT });
    expect(res.status).toBe(201);
    const body = res.body as CsvPreviewBody;
    expect(body.hasHeader).toBe(true);
    expect(body.headers).toEqual(['Date', 'Description', 'Amount', 'Category']);
    expect(body.columnCount).toBe(4);
    expect(body.rowCount).toBe(5);
    expect(body.mapping).toMatchObject({
      date: 0,
      merchant: 1,
      amount: 2,
      category: 3,
    });
    expect(body.ambiguous).toEqual([]);
    expect(body.sampleRows.length).toBeGreaterThan(0);
  });

  it('imports with correct inserted/duplicates/skipped/needsReview counts', async () => {
    const res = await agent.post('/api/import/csv').send({
      csv: STATEMENT,
      mapping: { date: 0, merchant: 1, amount: 2, category: 3 },
    });
    expect(res.status).toBe(201);
    expect(res.body as CsvImportBody).toEqual({
      inserted: 3,
      duplicates: 1,
      skipped: 1,
      needsReview: 1,
      totalRows: 5,
    });

    const rows = await db.select().from(transactions);
    expect(rows).toHaveLength(3);
    const coffee = rows.find((row) => row.merchant === 'Coffee');
    const gas = rows.find((row) => row.merchant === 'Gas');
    const paycheck = rows.find((row) => row.merchant === 'Paycheck');
    expect(coffee).toMatchObject({ category: 'Dining', source: 'csv' });
    expect(gas).toMatchObject({ category: 'Needs review' });
    expect(paycheck).toMatchObject({ category: 'Income', type: 'income' });
  });

  it('re-importing the same CSV counts everything as duplicates', async () => {
    const res = await agent.post('/api/import/csv').send({
      csv: STATEMENT,
      mapping: { date: 0, merchant: 1, amount: 2, category: 3 },
    });
    expect(res.status).toBe(201);
    expect(res.body as CsvImportBody).toEqual({
      inserted: 0,
      duplicates: 4,
      skipped: 1,
      needsReview: 0,
      totalRows: 5,
    });
  });

  it('maps a statement account to a managed account case-insensitively', async () => {
    await db.insert(accounts).values({ name: 'Checking' });

    const res = await agent.post('/api/import/csv').send({
      csv: [
        'Date,Description,Amount,Account',
        '2024-01-09,Rent,1200.00,checking',
        '2024-01-10,Other,10.00,Unknown',
      ].join('\n'),
      mapping: { date: 0, merchant: 1, amount: 2, account: 3 },
    });
    expect(res.status).toBe(201);
    expect((res.body as CsvImportBody).inserted).toBe(2);

    const rows = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.merchant, ['Rent', 'Other']));
    const rent = rows.find((row) => row.merchant === 'Rent');
    const other = rows.find((row) => row.merchant === 'Other');
    expect(rent!.account).toBe('Checking');
    expect(other!.account).toBe('Unknown');
  });

  it('rejects an invalid mapping', async () => {
    const res = await agent.post('/api/import/csv').send({
      csv: STATEMENT,
      mapping: { date: 0, merchant: 1, amount: 2, debit: 2 },
    });
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('INVALID_MAPPING');
  });
});
