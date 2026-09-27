import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManagedService, type CategoryUsage } from './managed.service';

const USER_ID = 'user-1';

const selectChain = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    orderBy: jest.fn(() => Promise.resolve(rows)),
    where: jest.fn(() => {
      const chain = { limit: jest.fn(() => Promise.resolve(rows)) };
      chain[Symbol.for('nodejs.util.promisify.custom')] = undefined;
      return Object.assign(Promise.resolve(rows), chain);
    }),
  })),
});

const insertChain = (rows: unknown[]) => ({
  values: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

const deleteChain = (rows: unknown[]) => ({
  where: jest.fn(() => ({
    returning: jest.fn(() => Promise.resolve(rows)),
  })),
});

const updateChain = (rows: unknown[]) => ({
  set: jest.fn(() => ({
    where: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve(rows)),
    })),
  })),
});

function dbMock() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(),
  };
}

function uniqueViolation(): Error {
  return Object.assign(new Error('unique_violation'), { code: '23505' });
}

/** Queues the four usage counts in the order countUsage() issues them. */
function mockUsageCounts(
  db: ReturnType<typeof dbMock>,
  counts: Partial<CategoryUsage> = {},
): void {
  const queued = [
    counts.transactions ?? 0,
    counts.recurring ?? 0,
    counts.subscriptions ?? 0,
    counts.budgets ?? 0,
  ];
  for (const n of queued) {
    db.select.mockReturnValueOnce(selectChain([{ n }]));
  }
}

describe('ManagedService', () => {
  let service: ManagedService;
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
    service = new ManagedService(db as never);
  });

  it('creates a category', async () => {
    const row = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.insert.mockReturnValue(insertChain([row]));
    await expect(service.createCategory(USER_ID, '  Food  ')).resolves.toBe(
      row,
    );
  });

  it('maps a unique violation on category create to a conflict', async () => {
    db.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.reject(uniqueViolation())),
      })),
    }));
    await expect(
      service.createCategory(USER_ID, 'Food'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws a 404 when deleting a missing category', async () => {
    db.select.mockReturnValue(selectChain([]));
    await expect(
      service.deleteCategory(USER_ID, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports which records still reference a category', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 3, budgets: 1 });
    await expect(service.getCategoryUsage(USER_ID, 'c1')).resolves.toEqual({
      name: 'Food',
      transactions: 3,
      recurring: 0,
      subscriptions: 0,
      budgets: 1,
    });
  });

  it('throws a 409 when deleting a category in use without a move target', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 3 });
    await expect(service.deleteCategory(USER_ID, 'c1')).rejects.toMatchObject({
      response: { code: 'CATEGORY_IN_USE' },
    });
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('names every referencing table in the 409 message', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 2, recurring: 1, budgets: 1 });
    await expect(service.deleteCategory(USER_ID, 'c1')).rejects.toMatchObject({
      response: {
        message:
          'Category "Food" is used by 2 transactions, 1 recurring payment, 1 budget — choose another category to move them to before deleting "Food".',
      },
    });
  });

  it('deletes a category that is not in use', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db);
    db.delete.mockReturnValue(deleteChain([cat]));
    await expect(
      service.deleteCategory(USER_ID, 'c1'),
    ).resolves.toBeUndefined();
  });

  it('rejects moving a category onto itself', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 1 });
    await expect(
      service.deleteCategory(USER_ID, 'c1', ' food '),
    ).rejects.toMatchObject({ response: { code: 'MOVE_TO_SAME_CATEGORY' } });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('merges into an existing category when moving records', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 2, budgets: 1 });
    // The move target already exists, so it is reused rather than created.
    db.select.mockReturnValueOnce(
      selectChain([{ id: 'c2', name: 'Dining Out', createdAt: new Date() }]),
    );
    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    );
    const chain = updateChain([]);
    db.update.mockReturnValue(chain);
    db.delete.mockReturnValue(deleteChain([cat]));

    await expect(
      service.deleteCategory(USER_ID, 'c1', '  Dining Out  '),
    ).resolves.toBeUndefined();

    expect(db.insert).not.toHaveBeenCalled();
    expect(chain.set.mock.calls.map((call) => call[0])).toEqual([
      { category: 'Dining Out' },
      { category: 'Dining Out' },
      { category: 'Dining Out' },
      { category: 'Dining Out' },
    ]);
    expect(db.delete).toHaveBeenCalled();
  });

  it('creates the target category when it does not exist yet', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 1 });
    db.select.mockReturnValueOnce(selectChain([]));
    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    );
    const insert = insertChain([{ id: 'c3', name: 'Other' }]);
    db.insert.mockReturnValue(insert);
    db.update.mockReturnValue(updateChain([]));
    db.delete.mockReturnValue(deleteChain([cat]));

    await expect(
      service.deleteCategory(USER_ID, 'c1', 'Other'),
    ).resolves.toBeUndefined();

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insert.values).toHaveBeenCalledWith({
      userId: USER_ID,
      name: 'Other',
    });
  });

  it('maps a unique violation while creating the move target to a conflict', async () => {
    const cat = { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') };
    db.select.mockReturnValueOnce(selectChain([cat]));
    mockUsageCounts(db, { transactions: 1 });
    db.select.mockReturnValueOnce(selectChain([]));
    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    );
    db.insert.mockImplementation(() => ({
      values: jest.fn(() => Promise.reject(uniqueViolation())),
    }));

    await expect(
      service.deleteCategory(USER_ID, 'c1', 'Other'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('renames a category and cascades the label across tables', async () => {
    const category = {
      id: 'c1',
      name: 'Food',
      createdAt: new Date('2026-01-01'),
    };
    const renamed = { ...category, name: 'Groceries' };
    db.select.mockReturnValue(selectChain([category]));
    db.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    );
    const chain = updateChain([renamed]);
    db.update.mockReturnValue(chain);
    await expect(
      service.renameCategory(USER_ID, 'c1', '  Groceries  '),
    ).resolves.toEqual(renamed);
    expect(chain.set.mock.calls[0][0]).toEqual({ category: 'Groceries' });
    expect(chain.set.mock.calls[1][0]).toEqual({ category: 'Groceries' });
    expect(chain.set.mock.calls[2][0]).toEqual({ category: 'Groceries' });
    expect(chain.set.mock.calls[3][0]).toEqual({ category: 'Groceries' });
    expect(chain.set.mock.calls[4][0]).toEqual({ name: 'Groceries' });
  });

  it('returns the category unchanged when renaming to the same name', async () => {
    const category = {
      id: 'c1',
      name: 'Food',
      createdAt: new Date('2026-01-01'),
    };
    db.select.mockReturnValue(selectChain([category]));
    await expect(service.renameCategory(USER_ID, 'c1', 'Food')).resolves.toBe(
      category,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('throws a 404 when renaming a missing category', async () => {
    db.select.mockReturnValue(selectChain([]));
    await expect(
      service.renameCategory(USER_ID, 'missing', 'Groceries'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a unique violation on rename to a conflict', async () => {
    db.select.mockReturnValue(
      selectChain([
        { id: 'c1', name: 'Food', createdAt: new Date('2026-01-01') },
      ]),
    );
    db.transaction.mockImplementation(() => Promise.reject(uniqueViolation()));
    await expect(
      service.renameCategory(USER_ID, 'c1', 'Groceries'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an account', async () => {
    const row = {
      id: 'a1',
      name: 'Checking',
      createdAt: new Date('2026-01-01'),
    };
    db.insert.mockReturnValue(insertChain([row]));
    await expect(service.createAccount(USER_ID, 'Checking')).resolves.toBe(row);
  });

  it('rejects a case-insensitive duplicate tag name', async () => {
    db.select.mockReturnValue(selectChain([{ name: 'Work', createdAt: 'x' }]));
    await expect(service.createTag(USER_ID, 'work')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a tag when the name is unused', async () => {
    db.select.mockReturnValue(selectChain([]));
    db.insert.mockReturnValue(insertChain([{ name: 'work', createdAt: 'x' }]));
    await expect(service.createTag(USER_ID, 'work')).resolves.toEqual({
      name: 'work',
    });
  });

  it('throws a 404 when deleting a missing tag', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(service.deleteTag(USER_ID, 'work')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists tags with usage counts', async () => {
    db.execute.mockResolvedValue({ rows: [{ name: 'work', count: 3 }] });
    await expect(service.listTags(USER_ID)).resolves.toEqual([
      { name: 'work', count: 3 },
    ]);
    expect(db.execute).toHaveBeenCalled();
  });
});
