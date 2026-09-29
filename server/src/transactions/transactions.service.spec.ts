import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { TransactionsService } from './transactions.service';

const USER_ID = 'user-1';

function makeSelectChain(rows: unknown[]) {
  const orderBy = jest.fn(() => Promise.resolve(rows));
  const limit = jest.fn(() => Promise.resolve(rows));
  const where = jest.fn(() => ({ orderBy, limit }));
  return {
    from: jest.fn(() => ({ where, orderBy })),
    where,
    orderBy,
  };
}

const insertChain = (rows: unknown[]) => ({
  values: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

/**
 * `set` returns an object holding `where`, so the chain is built eagerly to
 * hand that mock back. Digging it out of `set.mock.results[0].value` instead
 * would be untyped `any` and fail the type-aware lint rules.
 */
function updateChain(rows: unknown[]) {
  const where = jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  }));
  return { set: jest.fn(() => ({ where })), where };
}

const deleteChain = (rows: unknown[]) => ({
  where: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

function dbMock() {
  return {
    select: jest.fn(),
    selectDistinct: jest.fn(),
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

function deleteWhereSql(chain: ReturnType<typeof deleteChain>): {
  sql: string;
  params: unknown[];
} {
  const sqlWhere = chain.where.mock.calls[0][0];
  return new PgDialect().sqlToQuery(sqlWhere);
}

/** `updateChain` nests `where` inside the object returned by `set`. */
function updateWhereSql(chain: ReturnType<typeof updateChain>): {
  sql: string;
  params: unknown[];
} {
  return new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
}

function updateSetValue(chain: ReturnType<typeof updateChain>): unknown {
  return chain.set.mock.calls[0][0];
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
    service = new TransactionsService(
      db as never,
      {
        getAll: jest.fn().mockResolvedValue({
          customDateFrom: '2026-01-01',
          customDateTo: '2026-01-31',
        }),
      } as never,
    );
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

  it('exports through the same filters and scope as list', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    const query = {
      period: 'last-month' as const,
      type: 'expense' as const,
      category: 'Groceries',
    };
    await service.exportCsv(USER_ID, query);
    const sql = whereSql(chain);
    expect(sql.params).toEqual(expect.arrayContaining([USER_ID, 'Groceries']));
    expect(sql.sql).toContain('"category" =');
    expect(sql.sql).toContain('"type" =');
    expect(sql.sql).toContain('"date" >=');
  });

  it('renders exported rows as CSV', async () => {
    db.select.mockReturnValue(
      makeSelectChain([
        {
          id: 't1',
          date: '2026-01-15',
          merchant: 'Whole Foods',
          category: 'Groceries',
          amount: 84.5,
          type: 'expense',
          fromAccount: 'Checking',
          toAccount: null,
          side: null,
          tags: ['weekly'],
          notes: null,
          source: 'manual',
        },
      ]),
    );
    const csv = await service.exportCsv(USER_ID, {});
    expect(csv).toContain('Whole Foods');
    expect(csv).toContain('weekly');
  });

  it('applies custom period bounds from settings', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, {
      period: 'custom',
    });
    const sql = whereSql(chain);
    expect(sql.sql).toContain('"date" >=');
    expect(sql.sql).toContain('"date" <=');
    expect(sql.params).toEqual(
      expect.arrayContaining([USER_ID, '2026-01-01', '2026-01-31']),
    );
  });

  it('applies type, tag, date, and amount filters', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, {
      type: 'expense',
      tag: 'work',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      minAmount: 10,
      maxAmount: 100,
    });
    const sql = whereSql(chain);
    expect(sql.sql).toContain('"type" =');
    expect(sql.sql).toContain('"tags" @>');
    expect(sql.sql).toContain('"date" >=');
    expect(sql.sql).toContain('"date" <=');
    expect(sql.sql).toContain('"amount" >=');
    expect(sql.sql).toContain('"amount" <=');
    expect(sql.params).toEqual(
      expect.arrayContaining([
        USER_ID,
        'expense',
        '["work"]',
        '2026-01-01',
        '2026-01-31',
        10,
        100,
      ]),
    );
  });

  function orderBySql(chain: ReturnType<typeof makeSelectChain>): string[] {
    return chain.orderBy.mock.calls[0].map(
      (arg: unknown) => new PgDialect().sqlToQuery(arg as never).sql,
    );
  }

  it('defaults to newest-first by date', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, {});
    const [primary, tiebreaker] = orderBySql(chain);
    expect(primary).toContain('"date"');
    expect(primary).toContain('desc');
    expect(tiebreaker).toContain('"created_at"');
    expect(tiebreaker).toContain('desc');
  });

  it('sorts by amount descending when requested', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, { sortBy: 'amount', sortOrder: 'desc' });
    const [primary, tiebreaker] = orderBySql(chain);
    expect(primary).toContain('"amount"');
    expect(primary).toContain('desc');
    expect(tiebreaker).toContain('"created_at"');
    expect(tiebreaker).toContain('desc');
  });

  it('sorts ascending on text columns', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);
    await service.list(USER_ID, { sortBy: 'merchant', sortOrder: 'asc' });
    const [primary] = orderBySql(chain);
    expect(primary).toContain('"merchant"');
    expect(primary).toContain('asc');
  });

  describe('categoriesInUse', () => {
    function makeDistinctChain(rows: unknown[]) {
      const where = jest.fn(() => Promise.resolve(rows));
      return { from: jest.fn(() => ({ where })), where };
    }

    it('returns the distinct categories scoped to the user', async () => {
      const chain = makeDistinctChain([
        { category: 'Groceries' },
        { category: 'Dining' },
      ]);
      db.selectDistinct.mockReturnValue(chain);
      await expect(service.categoriesInUse(USER_ID, {})).resolves.toEqual([
        'Dining',
        'Groceries',
      ]);
      expect(whereSql(chain).params).toEqual([USER_ID]);
    });

    it('drops blank categories', async () => {
      const chain = makeDistinctChain([
        { category: '  ' },
        { category: 'Groceries' },
        { category: '' },
      ]);
      db.selectDistinct.mockReturnValue(chain);
      await expect(service.categoriesInUse(USER_ID, {})).resolves.toEqual([
        'Groceries',
      ]);
    });

    // The list filter compares with `=`, so an option must be the stored label
    // verbatim. Normalizing here would emit a value that selects nothing.
    it('returns stored labels verbatim, without trimming', async () => {
      const chain = makeDistinctChain([
        { category: ' Groceries ' },
        { category: 'Dining' },
      ]);
      db.selectDistinct.mockReturnValue(chain);
      await expect(service.categoriesInUse(USER_ID, {})).resolves.toEqual([
        ' Groceries ',
        'Dining',
      ]);
    });

    it('applies period bounds', async () => {
      const chain = makeDistinctChain([]);
      db.selectDistinct.mockReturnValue(chain);
      await service.categoriesInUse(USER_ID, { period: 'last-month' });
      const sql = whereSql(chain);
      expect(sql.sql).toContain('"date" >=');
      expect(sql.sql).toContain('"date" <=');
      expect(sql.params).toContain(USER_ID);
    });

    it('applies custom period bounds from settings', async () => {
      const chain = makeDistinctChain([]);
      db.selectDistinct.mockReturnValue(chain);
      await service.categoriesInUse(USER_ID, { period: 'custom' });
      expect(whereSql(chain).params).toEqual(
        expect.arrayContaining([USER_ID, '2026-01-01', '2026-01-31']),
      );
    });
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

  describe('peers', () => {
    function makeOrderByChain(rows: unknown[]) {
      const orderBy = jest.fn(() => Promise.resolve(rows));
      const where = jest.fn(() => ({ orderBy }));
      return { from: jest.fn(() => ({ where })), where, orderBy };
    }

    it('matches the merchant exactly and skips rows already in the category', async () => {
      const rows = [{ id: 't2', category: 'Needs review' }];
      const chain = makeOrderByChain(rows);
      db.select.mockReturnValue(chain);
      await expect(
        service.peers(USER_ID, {
          merchant: 'Whole Foods',
          category: 'Groceries',
        }),
      ).resolves.toEqual(rows);

      const sql = whereSql(chain);
      expect(sql.sql).toContain('"merchant" =');
      expect(sql.sql).toContain('"category" <>');
      expect(sql.params).toEqual([USER_ID, 'Whole Foods', 'Groceries']);
    });

    it('excludes the transaction that was just re-labelled', async () => {
      const chain = makeOrderByChain([]);
      db.select.mockReturnValue(chain);
      await service.peers(USER_ID, {
        merchant: 'Whole Foods',
        category: 'Groceries',
        excludeId: 't1',
      });
      const sql = whereSql(chain);
      expect(sql.sql).toContain('"id" <>');
      expect(sql.params).toContain('t1');
    });

    it('ignores the caller period so the prompt does not change with the view', async () => {
      const chain = makeOrderByChain([]);
      db.select.mockReturnValue(chain);
      await service.peers(USER_ID, {
        merchant: 'Whole Foods',
        category: 'Groceries',
      });
      // No `date` comparison: peers are the merchant's whole history.
      expect(whereSql(chain).sql).not.toContain('"date"');
    });

    it('returns the newest peers first', async () => {
      const chain = makeOrderByChain([]);
      db.select.mockReturnValue(chain);
      await service.peers(USER_ID, {
        merchant: 'Whole Foods',
        category: 'Groceries',
      });
      expect(orderBySql(chain)[0]).toContain('desc');
    });
  });

  describe('updateCategory', () => {
    it('re-labels the given ids scoped to the user', async () => {
      const rows = [{ id: 't1' }, { id: 't2' }];
      const chain = updateChain(rows);
      db.update.mockReturnValue(chain);
      await expect(
        service.updateCategory(USER_ID, {
          ids: ['t1', 't2'],
          category: 'Groceries',
        }),
      ).resolves.toEqual(rows);

      expect(updateSetValue(chain)).toEqual({ category: 'Groceries' });
      const sql = updateWhereSql(chain);
      expect(sql.sql).toContain('"user_id" =');
      expect(sql.sql).toContain('"id" in (');
      // One placeholder per id, so the scope is the user plus exactly these rows.
      expect(sql.params).toEqual([USER_ID, 't1', 't2']);
    });

    it('trims the category and falls back when it is blank', async () => {
      const chain = updateChain([]);
      db.update.mockReturnValue(chain);
      await service.updateCategory(USER_ID, { ids: ['t1'], category: '  ' });
      expect(updateSetValue(chain)).toEqual({ category: 'Needs review' });
    });

    // Ids the user does not own are dropped by the WHERE, so the response is
    // whatever actually changed — the client merges only rows it can see.
    it('returns just the rows the database changed', async () => {
      db.update.mockReturnValue(updateChain([{ id: 't1' }]));
      await expect(
        service.updateCategory(USER_ID, {
          ids: ['t1', 'missing'],
          category: 'Dining',
        }),
      ).resolves.toEqual([{ id: 't1' }]);
    });
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

  it('removes many transactions scoped to the user', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(
      service.removeMany(USER_ID, ['t1', 't2', 't3']),
    ).resolves.toBeUndefined();
    const conditions = db.delete.mock.results[0].value as ReturnType<
      typeof deleteChain
    >;
    const sql = deleteWhereSql(conditions);
    expect(sql.sql).toContain('"user_id" = $1');
    expect(sql.sql).toContain('"id" in ($2, $3, $4)');
    expect(sql.params).toEqual(['user-1', 't1', 't2', 't3']);
  });

  it('removeMany deletes nothing for an empty match (no throw)', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(
      service.removeMany(USER_ID, ['t1', 't2']),
    ).resolves.toBeUndefined();
  });
});
