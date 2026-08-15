import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { TransactionsService } from './transactions.service';

const USER_ID = 'user-1';

function makeSelectChain(rows: unknown[]) {
  const where = jest.fn(() => ({
    orderBy: jest.fn(() => Promise.resolve(rows)),
    limit: jest.fn(() => Promise.resolve(rows)),
  }));
  return {
    from: jest.fn(() => ({
      where,
      orderBy: jest.fn(() => Promise.resolve(rows)),
    })),
    where,
  };
}

const insertChain = (rows: unknown[]) => ({
  values: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

const updateChain = (rows: unknown[]) => ({
  set: jest.fn(() => ({
    where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve(rows)) })),
  })),
});

const deleteChain = (rows: unknown[]) => ({
  where: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

function dbMock() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function whereSql(chain: ReturnType<typeof makeSelectChain>): {
  sql: string;
  params: unknown[];
} {
  const sqlWhere = chain.where.mock.calls[0][0];
  return new PgDialect().sqlToQuery(sqlWhere);
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
    service = new TransactionsService(db as never);
  });

  it('lists transactions scoped to the user without filters', async () => {
    const rows = [{ id: 't1' }];
    const chain = makeSelectChain(rows);
    db.select.mockReturnValue(chain);
    await expect(service.list(USER_ID, {})).resolves.toEqual(rows);
    const sql = whereSql(chain);
    expect(sql.params).toEqual([USER_ID]);
  });

  it('applies period bounds', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, {
      period: 'last-month',
    });
    const sql = whereSql(chain);
    expect(sql.sql).toContain('"date" >=');
    expect(sql.sql).toContain('"date" <=');
  });

  it('applies type, tag, date, amount, and receipt filters', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, {
      type: 'expense',
      tag: 'work',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      minAmount: 10,
      maxAmount: 100,
      receipt: 'true',
    });
    const sql = whereSql(chain);
    expect(sql.sql).toContain('"type" =');
    expect(sql.sql).toContain('"tags" @>');
    expect(sql.sql).toContain('"date" >=');
    expect(sql.sql).toContain('"date" <=');
    expect(sql.sql).toContain('"amount" >=');
    expect(sql.sql).toContain('"amount" <=');
    expect(sql.sql).toContain('"receipt" =');
    expect(sql.params).toEqual(
      expect.arrayContaining([
        USER_ID,
        'expense',
        '["work"]',
        '2026-01-01',
        '2026-01-31',
        10,
        100,
        true,
      ]),
    );
  });

  it('maps receipt=false to a false equality', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, { receipt: 'false' });
    const sql = whereSql(chain);
    expect(sql.sql).toContain('"receipt" =');
    expect(sql.params).toEqual(expect.arrayContaining([USER_ID, false]));
  });

  it('creates a transaction', async () => {
    const row = { id: 't1', merchant: 'Coffee', amount: 4.5 };
    db.insert.mockReturnValue(insertChain([row]));
    await expect(
      service.create(USER_ID, {
        date: '2026-01-01',
        merchant: ' Coffee ',
        amount: 4.5,
        type: 'expense',
      }),
    ).resolves.toBe(row);
  });

  it('throws conflict when creating a duplicate transaction', async () => {
    db.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() =>
          Promise.reject(
            Object.assign(new Error('duplicate'), { code: '23505' }),
          ),
        ),
      })),
    }));
    await expect(
      service.create(USER_ID, {
        date: '2026-01-01',
        merchant: 'Coffee',
        amount: 4.5,
        type: 'expense',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates an existing transaction', async () => {
    const current = { id: 't1', merchant: 'Coffee', amount: 4.5, tags: [] };
    const updated = { ...current, amount: 5 };
    db.select.mockReturnValue(makeSelectChain([current]));
    db.update.mockReturnValue(updateChain([updated]));
    await expect(service.update(USER_ID, 't1', { amount: 5 })).resolves.toEqual(
      updated,
    );
  });

  it('throws not found when updating a missing transaction', async () => {
    db.select.mockReturnValue(makeSelectChain([]));
    await expect(
      service.update(USER_ID, 't1', { amount: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an existing transaction', async () => {
    db.delete.mockReturnValue(deleteChain([{ id: 't1' }]));
    await expect(service.remove(USER_ID, 't1')).resolves.toBeUndefined();
  });

  it('throws not found when removing a missing transaction', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(service.remove(USER_ID, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
