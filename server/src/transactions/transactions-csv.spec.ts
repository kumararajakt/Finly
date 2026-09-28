import { parse } from 'csv/sync';
import type { Transaction } from '../database/schema';
import {
  CSV_COLUMNS,
  transactionToRow,
  transactionsToCsv,
} from './transactions-csv';

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
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
    tags: [],
    notes: null,
    source: 'manual',
    fingerprint: 'fp1',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

function records(csv: string): Record<string, string>[] {
  const [header, ...rows] = parse(csv, { bom: true, skip_empty_lines: true });
  if (header === undefined) return [];
  const columns = header;
  return rows
    .filter((cells) => cells.some((cell) => cell !== ''))
    .map((cells) =>
      Object.fromEntries(columns.map((name, i) => [name, cells[i] ?? ''])),
    );
}

describe('transactionsToCsv', () => {
  it('writes the header in a fixed order', () => {
    const [header] = transactionsToCsv([transaction()]).split('\n');
    expect(header?.replace('﻿', '')).toBe(CSV_COLUMNS.join(','));
  });

  it('starts with a BOM so Excel reads non-ASCII correctly', () => {
    expect(transactionsToCsv([transaction()]).charCodeAt(0)).toBe(0xfeff);
  });

  it('writes a full row', () => {
    const [row] = records(
      transactionsToCsv([
        transaction({
          toAccount: 'Savings',
          side: 'buy',
          tags: ['weekly', 'shared'],
          notes: 'Split with Sam',
          source: 'csv',
        }),
      ]),
    );
    expect(row).toEqual({
      date: '2026-01-15',
      type: 'expense',
      merchant: 'Whole Foods',
      category: 'Groceries',
      amount: '84.5',
      account: 'Checking',
      toAccount: 'Savings',
      side: 'buy',
      tags: 'weekly;shared',
      notes: 'Split with Sam',
      source: 'csv',
    });
  });

  it('writes nulls and empty tag lists as empty cells', () => {
    const [row] = records(transactionsToCsv([transaction()]));
    expect(row.toAccount).toBe('');
    expect(row.side).toBe('');
    expect(row.notes).toBe('');
    expect(row.tags).toBe('');
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = transactionsToCsv([
      transaction({
        merchant: 'Cafe, Central',
        notes: 'Said "yes"\nthen left',
      }),
    ]);
    const [row] = records(csv);
    expect(row.merchant).toBe('Cafe, Central');
    expect(row.notes).toBe('Said "yes"\nthen left');
  });

  it('writes a header with no rows when the filter matched nothing', () => {
    const csv = transactionsToCsv([]);
    expect(records(csv)).toEqual([]);
    expect(csv.replace('﻿', '').trim()).toBe(CSV_COLUMNS.join(','));
  });

  it('keeps amount positive and leaves the sign in type', () => {
    expect(
      transactionToRow(transaction({ amount: 100, type: 'income' })),
    ).toMatchObject({ amount: 100, type: 'income' });
  });

  it('omits internal id, userId and fingerprint columns', () => {
    expect(CSV_COLUMNS).not.toContain('id');
    expect(CSV_COLUMNS).not.toContain('userId');
    expect(CSV_COLUMNS).not.toContain('fingerprint');
  });
});
