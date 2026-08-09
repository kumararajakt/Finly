import { NotFoundException } from '@nestjs/common';
import { RulesService } from './rules.service';

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

describe('RulesService', () => {
  let service: RulesService;
  let db: ReturnType<typeof dbMock>;

  beforeEach(() => {
    db = dbMock();
    service = new RulesService(db as never);
  });

  it('lists rules ordered by creation', async () => {
    const rows = [{ id: 'r1' }];
    db.select.mockReturnValue(selectChain(rows));
    await expect(service.list()).resolves.toEqual(rows);
  });

  it('creates a rule with defaults', async () => {
    const row = { id: 'r1', whenText: 'x', thenText: 'y', enabled: true };
    db.insert.mockReturnValue(insertChain([row]));
    await expect(
      service.create({ whenText: ' x ', thenText: ' y ' }),
    ).resolves.toBe(row);
  });

  it('trims whenText and thenText on create', async () => {
    const chain = insertChain([{}]);
    db.insert.mockReturnValue(chain);
    await service.create({ whenText: '  when  ', thenText: '  then  ' });
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ whenText: 'when', thenText: 'then' }),
    );
  });

  it('updates an existing rule', async () => {
    const current = { id: 'r1', whenText: 'a', thenText: 'b', enabled: true };
    const updated = { ...current, enabled: false };
    db.select.mockReturnValue(selectChain([current]));
    db.update.mockReturnValue(updateChain([updated]));
    await expect(service.update('r1', { enabled: false })).resolves.toEqual(
      updated,
    );
  });

  it('throws not found when updating a missing rule', async () => {
    db.select.mockReturnValue(selectChain([]));
    await expect(
      service.update('r1', { enabled: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an existing rule', async () => {
    db.delete.mockReturnValue(deleteChain([{ id: 'r1' }]));
    await expect(service.remove('r1')).resolves.toBeUndefined();
  });

  it('throws not found when removing a missing rule', async () => {
    db.delete.mockReturnValue(deleteChain([]));
    await expect(service.remove('r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
