import { BadRequestException } from '@nestjs/common';
import { computeFingerprint } from '../common/fingerprint';
import { accounts, categories, transactions } from '../database/schema';
import { ImportService } from './import.service';

type InsertValues = Record<string, unknown>;

interface DbOptions {
  categories?: string[];
  accounts?: string[];
  existingFingerprints?: string[];
  insertReturnsAll?: boolean;
}

function makeDb(options: DbOptions = {}) {
  const categoryNames = options.categories ?? [];
  const accountNames = options.accounts ?? [];
  const existing = options.existingFingerprints ?? [];
  const insertReturnsAll = options.insertReturnsAll ?? true;
  const valuesCalls: InsertValues[][] = [];

  const queryResult = (rows: unknown[]) => {
    const promise = Promise.resolve(rows) as unknown as { where: jest.Mock };
    promise.where = jest.fn(() => Promise.resolve(rows));
    return promise;
  };

  const from = jest.fn((table: unknown) => {
    if (table === categories) {
      return queryResult(categoryNames.map((name) => ({ name })));
    }
    if (table === accounts) {
      return queryResult(accountNames.map((name) => ({ name })));
    }
    if (table === transactions) {
      return queryResult(existing.map((fingerprint) => ({ fingerprint })));
    }
    return queryResult([]);
  });

  const select = jest.fn(() => ({ from }));

  const insert = jest.fn(() => ({
    values: jest.fn((rows: InsertValues[]) => {
      valuesCalls.push(rows);
      return {
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(() => {
            if (!insertReturnsAll) {
              return Promise.resolve([]);
            }
            return Promise.resolve(
              rows.map((row) => ({ id: String(row.fingerprint) })),
            );
          }),
        })),
      };
    }),
  }));

  return {
    db: {
      select,
      insert,
    } as never,
    valuesCalls,
  };
}

const STATEMENT = [
  'Date,Description,Amount',
  '2024-01-05,Coffee,5.50',
  '2024-01-06,Salary,-3000.00',
].join('\n');

describe('ImportService', () => {
  let service: ImportService;

  describe('preview', () => {
    it('detects headers, columns, and returns sample rows', () => {
      const { db } = makeDb();
      service = new ImportService(db);
      const result = service.preview({
        csv: 'Date,Description,Debit,Credit\n2024-01-05,Coffee,5.50,\n2024-01-06,Pay,,\n',
      });
      expect(result.hasHeader).toBe(true);
      expect(result.headers).toEqual([
        'Date',
        'Description',
        'Debit',
        'Credit',
      ]);
      expect(result.mapping.date).toBe(0);
      expect(result.mapping.merchant).toBe(1);
      expect(result.mapping.debit).toBe(2);
      expect(result.mapping.credit).toBe(3);
      expect(result.ambiguous).toEqual([]);
      expect(result.sampleRows.length).toBeGreaterThan(0);
    });

    it('rejects an empty CSV', () => {
      const { db } = makeDb();
      service = new ImportService(db);
      expect(() => service.preview({ csv: '\n\n' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('importCsv', () => {
    it('maps negative rows to expense and positive rows to income', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: STATEMENT,
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result).toEqual({
        inserted: 2,
        duplicates: 0,
        skipped: 0,
        needsReview: 2,
        totalRows: 2,
      });

      const values = valuesCalls.flat();
      const coffee = values.find((value) => value.merchant === 'Coffee');
      const salary = values.find((value) => value.merchant === 'Salary');
      expect(coffee).toMatchObject({
        date: '2024-01-05',
        amount: 5.5,
        type: 'income',
        source: 'csv',
        receipt: false,
        tags: [],
      });
      expect(salary).toMatchObject({
        date: '2024-01-06',
        amount: 3000,
        type: 'expense',
        source: 'csv',
        receipt: false,
      });
    });

    it('respects the negative-income sign convention', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      await service.importCsv({
        csv: 'Date,Description,Amount\n2024-01-05,Fee,-50.00\n',
        mapping: { date: 0, merchant: 1, amount: 2 },
        signConvention: 'negative-income',
      });

      const values = valuesCalls.flat();
      expect(values.find((value) => value.merchant === 'Fee')).toMatchObject({
        amount: 50,
        type: 'income',
      });
    });

    it('preserves a supported statement category and falls back to Needs review', async () => {
      const { db, valuesCalls } = makeDb({ categories: ['Dining'] });
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: 'Date,Description,Amount,Category\n2024-01-05,Coffee,5.50,Dining\n2024-01-06,Gas,40.00,Automotive\n',
        mapping: { date: 0, merchant: 1, amount: 2, category: 3 },
      });

      const values = valuesCalls.flat();
      expect(values.find((value) => value.merchant === 'Coffee')).toMatchObject(
        {
          category: 'Dining',
        },
      );
      expect(values.find((value) => value.merchant === 'Gas')).toMatchObject({
        category: 'Needs review',
      });
      expect(result.needsReview).toBe(1);
    });

    it('normalizes dates according to the detected order', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      await service.importCsv({
        csv: 'Date,Description,Amount\n15/01/2024,Rent,1200.00\n',
        mapping: { date: 0, merchant: 1, amount: 2, dateOrder: 'dmY' },
      });

      const values = valuesCalls.flat();
      expect(values[0].date).toBe('2024-01-15');
    });

    it('maps debit and credit columns', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: 'Date,Description,Debit,Credit\n2024-01-05,Coffee,5.50,\n2024-01-06,Paycheck,,2500.00\n',
        mapping: { date: 0, merchant: 1, debit: 2, credit: 3 },
      });

      expect(result).toMatchObject({ inserted: 2, skipped: 0 });
      const values = valuesCalls.flat();
      expect(values.find((value) => value.merchant === 'Coffee')).toMatchObject(
        {
          type: 'expense',
          amount: 5.5,
        },
      );
      expect(
        values.find((value) => value.merchant === 'Paycheck'),
      ).toMatchObject({ type: 'income', amount: 2500 });
    });

    it('skips rows with invalid dates, amounts, or merchants', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: [
          'Date,Description,Amount',
          'not-a-date,Coffee,5.50',
          '2024-01-06,,3.00',
          '2024-01-07,Snacks,',
          '2024-01-08,Valid,10.00',
        ].join('\n'),
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result).toEqual({
        inserted: 1,
        duplicates: 0,
        skipped: 3,
        needsReview: 1,
        totalRows: 4,
      });
      expect(valuesCalls.flat().map((value) => value.merchant)).toEqual([
        'Valid',
      ]);
    });

    it('reports duplicates via the fingerprint', async () => {
      const existing = computeFingerprint({
        type: 'income',
        date: '2024-01-05',
        merchant: 'Coffee',
        amount: 5.5,
      });
      const { db, valuesCalls } = makeDb({
        existingFingerprints: [existing],
      });
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: [
          'Date,Description,Amount',
          '2024-01-05,Coffee,5.50',
          '2024-01-06,Rent,1200.00',
        ].join('\n'),
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result).toEqual({
        inserted: 1,
        duplicates: 1,
        skipped: 0,
        needsReview: 1,
        totalRows: 2,
      });
      expect(valuesCalls.flat().map((value) => value.merchant)).toEqual([
        'Rent',
      ]);
    });

    it('does not require a header row', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv({
        csv: '2024-01-05,Coffee,5.50\n2024-01-06,Rent,1200.00\n',
        mapping: { date: 0, merchant: 1, amount: 2, hasHeader: false },
      });

      expect(result.inserted).toBe(2);
      expect(valuesCalls.flat().map((value) => value.merchant)).toEqual([
        'Coffee',
        'Rent',
      ]);
    });

    it('rejects a mapping that combines amount with debit/credit', async () => {
      const { db } = makeDb();
      service = new ImportService(db);
      await expect(
        service.importCsv({
          csv: STATEMENT,
          mapping: { date: 0, merchant: 1, amount: 2, debit: 2 },
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MAPPING' } });
    });

    it('rejects an out-of-range column index', async () => {
      const { db } = makeDb();
      service = new ImportService(db);
      await expect(
        service.importCsv({
          csv: STATEMENT,
          mapping: { date: 0, merchant: 1, amount: 9 },
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MAPPING' } });
    });

    it('uses a managed account when the account column matches', async () => {
      const { db, valuesCalls } = makeDb({ accounts: ['Checking'] });
      service = new ImportService(db);

      await service.importCsv({
        csv: 'Date,Description,Amount,Account\n2024-01-05,Coffee,5.50,checking\n',
        mapping: { date: 0, merchant: 1, amount: 2, account: 3 },
      });

      const values = valuesCalls.flat();
      expect(values[0].account).toBe('Checking');
    });
  });
});
