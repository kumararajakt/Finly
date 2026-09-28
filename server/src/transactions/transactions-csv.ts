import { stringify } from 'csv/sync';
import type { Transaction } from '../database/schema';

/**
 * Column names are chosen so the export feeds straight back into
 * `POST import/csv`: `import/csv.ts` detects `date`, `type`, `merchant`,
 * `category`, `amount`, `account` and `notes` by keyword, and the explicit
 * `type` column means no `signConvention` guess is needed.
 */
export const CSV_COLUMNS = [
  'date',
  'type',
  'merchant',
  'category',
  'amount',
  'account',
  'toAccount',
  'side',
  'tags',
  'notes',
  'receipt',
  'source',
] as const;

/** Amounts are positive magnitudes; the sign lives in `type`, as everywhere else. */
function cell(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  return value as string | number;
}

export function transactionToRow(
  transaction: Transaction,
): Record<(typeof CSV_COLUMNS)[number], string | number> {
  return {
    date: transaction.date,
    type: transaction.type,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: transaction.amount,
    account: transaction.fromAccount,
    toAccount: cell(transaction.toAccount),
    side: cell(transaction.side),
    tags: transaction.tags.join(';'),
    notes: cell(transaction.notes),
    receipt: transaction.receipt ? 'true' : 'false',
    source: transaction.source,
  };
}

/** `bom` keeps Excel from mangling non-ASCII merchants and categories. */
export function transactionsToCsv(transactions: Transaction[]): string {
  return stringify(transactions.map(transactionToRow), {
    header: true,
    columns: [...CSV_COLUMNS],
    bom: true,
  });
}
