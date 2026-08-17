import { BadRequestException } from '@nestjs/common';
import { computeFingerprint } from '../common/fingerprint';
import { accounts, categories, transactions } from '../database/schema';
import { ImportService } from './import.service';

const USER_ID = 'user-1';

type InsertValues = Record<string, unknown>;

interface DbOptions {
  categories?: string[];
  accounts?: string[];
  existingFingerprints?: string[];
  insertReturnsAll?: boolean;
  failInsertAtCall?: number;
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

  let insertCalls = 0;
  const insert = jest.fn(() => {
    insertCalls += 1;
    return {
      values: jest.fn((rows: InsertValues[]) => {
        valuesCalls.push(rows);
        return {
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() => {
              if (options.failInsertAtCall === insertCalls) {
                return Promise.reject(new Error('connection terminated'));
              }
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
    };
  });

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

      const result = await service.importCsv(USER_ID, {
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

      await service.importCsv(USER_ID, {
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

    it('keeps a supported statement category and auto-creates a missing one', async () => {
      const { db, valuesCalls } = makeDb({ categories: ['Dining'] });
      service = new ImportService(db);

      const result = await service.importCsv(USER_ID, {
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
        category: 'Automotive',
      });
      expect(valuesCalls[0]).toEqual([{ userId: USER_ID, name: 'Automotive' }]);
      expect(result.needsReview).toBe(0);
    });

    it('auto-creates missing categories and accounts for inserted rows', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv(USER_ID, {
        csv: 'Date,Description,Amount,Category,Account\n2024-01-05,Coffee,5.50,Breakfast,Main wallet\n2024-01-06,Paycheck,3000.00,Breakfast,Main wallet\n',
        mapping: {
          date: 0,
          merchant: 1,
          amount: 2,
          category: 3,
          account: 4,
        },
      });

      expect(result).toMatchObject({
        inserted: 2,
        needsReview: 0,
      });
      expect(valuesCalls[0]).toEqual([{ userId: USER_ID, name: 'Breakfast' }]);
      expect(valuesCalls[1]).toEqual([
        { userId: USER_ID, name: 'Main wallet' },
      ]);
      const values = valuesCalls.flat();
      expect(values.find((value) => value.merchant === 'Coffee')).toMatchObject(
        {
          category: 'Breakfast',
          fromAccount: 'Main wallet',
        },
      );
    });

    it('does not auto-create categories or accounts for duplicate rows', async () => {
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

      const result = await service.importCsv(USER_ID, {
        csv: 'Date,Description,Amount,Category\n2024-01-05,Coffee,5.50,NewCat\n',
        mapping: { date: 0, merchant: 1, amount: 2, category: 3 },
      });

      expect(result).toMatchObject({ inserted: 0, duplicates: 1 });
      expect(
        valuesCalls.some((call) =>
          call.some((value) => value.name === 'NewCat'),
        ),
      ).toBe(false);
    });

    it('auto-detects and normalizes DD/MM/YYYY dates', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      await service.importCsv(USER_ID, {
        csv: 'Date,Description,Amount\n15/01/2024,Rent,1200.00\n',
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      const values = valuesCalls.flat();
      expect(values[0].date).toBe('2024-01-15');
    });

    it('maps debit and credit columns', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv(USER_ID, {
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

      const result = await service.importCsv(USER_ID, {
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

      const result = await service.importCsv(USER_ID, {
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

    it('counts rows duplicated within the file once and inserts them once', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv(USER_ID, {
        csv: [
          'Date,Description,Amount',
          '2024-01-05,Coffee,5.50',
          '2024-01-05,Coffee,5.50',
          '2024-01-06,Rent,1200.00',
        ].join('\n'),
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result).toEqual({
        inserted: 2,
        duplicates: 1,
        skipped: 0,
        needsReview: 2,
        totalRows: 3,
      });
      expect(valuesCalls.flat().map((value) => value.merchant)).toEqual([
        'Coffee',
        'Rent',
      ]);
    });

    it('does not require a header row', async () => {
      const { db, valuesCalls } = makeDb();
      service = new ImportService(db);

      const result = await service.importCsv(USER_ID, {
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
        service.importCsv(USER_ID, {
          csv: STATEMENT,
          mapping: { date: 0, merchant: 1, amount: 2, debit: 2 },
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MAPPING' } });
    });

    it('rejects an out-of-range column index', async () => {
      const { db } = makeDb();
      service = new ImportService(db);
      await expect(
        service.importCsv(USER_ID, {
          csv: STATEMENT,
          mapping: { date: 0, merchant: 1, amount: 9 },
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MAPPING' } });
    });

    it('uses a managed account when the account column matches', async () => {
      const { db, valuesCalls } = makeDb({ accounts: ['Checking'] });
      service = new ImportService(db);

      await service.importCsv(USER_ID, {
        csv: 'Date,Description,Amount,Account\n2024-01-05,Coffee,5.50,checking\n',
        mapping: { date: 0, merchant: 1, amount: 2, account: 3 },
      });

      const values = valuesCalls.flat();
      expect(values[0].fromAccount).toBe('Checking');
    });

    it('reports partial status when the batch fails mid-insert', async () => {
      const { db, valuesCalls } = makeDb({ failInsertAtCall: 2 });
      service = new ImportService(db);

      const rows = Array.from(
        { length: 600 },
        (_, i) => `2024-01-05,Merchant ${i},${(i + 1).toFixed(2)}`,
      );
      const csv = ['Date,Description,Amount', ...rows].join('\n');

      let caught:
        { response?: { message?: string; code?: string } } | undefined;
      try {
        await service.importCsv(USER_ID, {
          csv,
          mapping: { date: 0, merchant: 1, amount: 2 },
        });
      } catch (error) {
        caught = error as { response?: { message?: string; code?: string } };
      }
      expect(caught?.response?.code).toBe('PARTIAL_IMPORT');
      expect(caught?.response?.message).toContain('500 of 600');
      expect(valuesCalls).toHaveLength(2);
      expect(valuesCalls[0]).toHaveLength(500);
      expect(valuesCalls[1]).toHaveLength(100);
    });
  });

  describe('previewRows', () => {
    it('returns every parsed row with an insert status', async () => {
      const { db } = makeDb();
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: STATEMENT,
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result).toEqual({
        rows: [
          {
            date: '2024-01-05',
            merchant: 'Coffee',
            amount: 5.5,
            type: 'income',
            category: 'Needs review',
            fromAccount: 'Imported account',
            notes: null,
            status: 'insert',
          },
          {
            date: '2024-01-06',
            merchant: 'Salary',
            amount: 3000,
            type: 'expense',
            category: 'Needs review',
            fromAccount: 'Imported account',
            notes: null,
            status: 'insert',
          },
        ],
        inserted: 2,
        duplicates: 0,
        skipped: 0,
        needsReview: 2,
        totalRows: 2,
        newCategories: [],
        newAccounts: [],
      });
    });

    it('reports which categories and accounts would be created', async () => {
      const { db } = makeDb({ categories: ['Dining'] });
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: 'Date,Description,Amount,Category,Account\n2024-01-05,Coffee,5.50,Dining,Main wallet\n2024-01-06,Paycheck,3000.00,Breakfast,checking\n',
        mapping: {
          date: 0,
          merchant: 1,
          amount: 2,
          category: 3,
          account: 4,
        },
      });

      expect(result.rows.map((row) => row.category)).toEqual([
        'Dining',
        'Breakfast',
      ]);
      expect(result).toMatchObject({
        newCategories: ['Breakfast'],
        newAccounts: ['Main wallet', 'checking'],
      });
    });

    it('excludes duplicates from the would-be-created labels', async () => {
      const existing = computeFingerprint({
        type: 'income',
        date: '2024-01-05',
        merchant: 'Coffee',
        amount: 5.5,
      });
      const { db } = makeDb({ existingFingerprints: [existing] });
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: 'Date,Description,Amount,Category\n2024-01-05,Coffee,5.50,NewCat\n2024-01-06,Paycheck,3000.00,OtherCat\n',
        mapping: { date: 0, merchant: 1, amount: 2, category: 3 },
      });

      expect(result).toMatchObject({
        newCategories: ['OtherCat'],
      });
    });

    it('marks rows whose fingerprint already exists as duplicates', async () => {
      const existing = computeFingerprint({
        type: 'income',
        date: '2024-01-05',
        merchant: 'Coffee',
        amount: 5.5,
      });
      const { db } = makeDb({ existingFingerprints: [existing] });
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: STATEMENT,
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result.rows[0]).toMatchObject({
        merchant: 'Coffee',
        status: 'duplicate',
      });
      expect(result.rows[1]).toMatchObject({ status: 'insert' });
      expect(result).toMatchObject({
        inserted: 1,
        duplicates: 1,
        needsReview: 1,
      });
    });

    it('flags rows duplicated within the file', async () => {
      const { db } = makeDb();
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: [
          'Date,Description,Amount',
          '2024-01-05,Coffee,5.50',
          '2024-01-05,Coffee,5.50',
        ].join('\n'),
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result.rows.map((row) => row.status)).toEqual([
        'insert',
        'duplicate',
      ]);
      expect(result).toMatchObject({ inserted: 1, duplicates: 1 });
    });

    it('marks invalid rows as skipped with empty fields', async () => {
      const { db } = makeDb();
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: [
          'Date,Description,Amount',
          'not-a-date,Coffee,5.50',
          '2024-01-06,,3.00',
          '2024-01-07,Valid,10.00',
        ].join('\n'),
        mapping: { date: 0, merchant: 1, amount: 2 },
      });

      expect(result.rows).toEqual([
        {
          date: '',
          merchant: '',
          amount: 0,
          type: 'expense',
          category: '',
          fromAccount: '',
          notes: null,
          status: 'skipped',
        },
        {
          date: '',
          merchant: '',
          amount: 0,
          type: 'expense',
          category: '',
          fromAccount: '',
          notes: null,
          status: 'skipped',
        },
        {
          date: '2024-01-07',
          merchant: 'Valid',
          amount: 10,
          type: 'income',
          category: 'Needs review',
          fromAccount: 'Imported account',
          notes: null,
          status: 'insert',
        },
      ]);
      expect(result).toMatchObject({
        inserted: 1,
        duplicates: 0,
        skipped: 2,
        needsReview: 1,
        totalRows: 3,
      });
    });

    it('reuses the mapped category and account labels', async () => {
      const { db } = makeDb({ categories: ['Dining'], accounts: ['Checking'] });
      service = new ImportService(db);

      const result = await service.previewRows(USER_ID, {
        csv: 'Date,Description,Amount,Category,Account\n2024-01-05,Coffee,5.50,Dining,checking\n',
        mapping: { date: 0, merchant: 1, amount: 2, category: 3, account: 4 },
      });

      expect(result.rows[0]).toMatchObject({
        category: 'Dining',
        fromAccount: 'Checking',
      });
    });
  });
});
