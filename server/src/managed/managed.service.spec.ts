import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManagedService } from './managed.service';

const USER_ID = 'user-1';

const selectChain = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    orderBy: jest.fn(() => Promise.resolve(rows)),
    where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve(rows)) })),
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
    db.delete.mockReturnValue(deleteChain([]));
    await expect(
      service.deleteCategory(USER_ID, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
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
