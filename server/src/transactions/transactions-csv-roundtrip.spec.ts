import { detectColumns, detectDirection, parseCsv } from '../import/csv';
import { CSV_COLUMNS, transactionsToCsv } from './transactions-csv';
import type { Transaction } from '../database/schema';

const BASE: Transaction = {
  id: 't1',
  userId: 'user-1',
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
  fingerprint: 'fp1',
  createdAt: new Date('2026-01-15T10:00:00Z'),
};

function headersOf(csv: string): string[] {
  const firstLine = csv.split('\n')[0] ?? '';
  return firstLine.replace('﻿', '').split(',');
}

describe('transactions export → import round trip', () => {
  it('re-detects every column the importer needs without ambiguity', () => {
    const detection = detectColumns(headersOf(transactionsToCsv([BASE])));
    expect(detection.ambiguous).toEqual([]);
  });

  it('maps date, merchant, amount, category, type, account and notes to the right columns', () => {
    const { mapping } = detectColumns(headersOf(transactionsToCsv([BASE])));
    const index = (name: (typeof CSV_COLUMNS)[number]) =>
      CSV_COLUMNS.indexOf(name);

    expect(mapping.date).toBe(index('date'));
    expect(mapping.merchant).toBe(index('merchant'));
    expect(mapping.amount).toBe(index('amount'));
    expect(mapping.category).toBe(index('category'));
    expect(mapping.type).toBe(index('type'));
    expect(mapping.account).toBe(index('account'));
    expect(mapping.notes).toBe(index('notes'));
  });

  it('uses an explicit amount column, so no debit/credit split is needed', () => {
    const { mapping } = detectColumns(headersOf(transactionsToCsv([BASE])));
    expect(mapping.amount).not.toBeNull();
    expect(mapping.debit).toBeNull();
    expect(mapping.credit).toBeNull();
  });

  it('resolves every type value, so the importer needs no signConvention guess', () => {
    const rows = parseCsv(
      transactionsToCsv([BASE, { ...BASE, type: 'income' }]),
    );
    const typeColumn = CSV_COLUMNS.indexOf('type');
    const direction = detectDirection(rows.slice(1), typeColumn);
    expect(direction.ambiguous).toBe(false);
    expect(direction.guess).toEqual({ expense: 'expense', income: 'income' });
  });

  it('does not let toAccount be mistaken for the account column', () => {
    const { mapping } = detectColumns(
      headersOf(transactionsToCsv([{ ...BASE, toAccount: 'Savings' }])),
    );
    expect(mapping.account).toBe(CSV_COLUMNS.indexOf('account'));
  });
});
