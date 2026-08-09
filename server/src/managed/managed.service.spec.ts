import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManagedService } from './managed.service';

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

function dbMock() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(),
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
    await expect(service.createCategory('  Food  ')).resolves.toBe(row);
  });

  it('maps a unique violation on category create to a conflict', async () => {
    db.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => Promise.reject(uniqueViolation())),
      })),
    }));
    await expect(service.createCategory('Food')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws a 404 when deleting a missing category', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(service.deleteCategory('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates an account', async () => {
    const row = {
      id: 'a1',
      name: 'Checking',
      createdAt: new Date('2026-01-01'),
    };
    db.insert.mockReturnValue(insertChain([row]));
    await expect(service.createAccount('Checking')).resolves.toBe(row);
  });

  it('rejects a case-insensitive duplicate tag name', async () => {
    db.select.mockReturnValue(selectChain([{ name: 'Work', createdAt: 'x' }]));
    await expect(service.createTag('work')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a tag when the name is unused', async () => {
    db.select.mockReturnValue(selectChain([]));
    db.insert.mockReturnValue(insertChain([{ name: 'work', createdAt: 'x' }]));
    await expect(service.createTag('work')).resolves.toEqual({ name: 'work' });
  });

  it('throws a 404 when deleting a missing tag', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(service.deleteTag('work')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists tags with usage counts', async () => {
    db.execute.mockResolvedValue({ rows: [{ name: 'work', count: 3 }] });
    await expect(service.listTags()).resolves.toEqual([
      { name: 'work', count: 3 },
    ]);
    expect(db.execute).toHaveBeenCalled();
  });
});
