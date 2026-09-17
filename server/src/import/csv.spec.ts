import {
  detectColumns,
  detectDirection,
  detectHeaderRow,
  guessDirectionValue,
  normalizeDate,
  parseAmount,
  parseCsv,
} from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    const result = parseCsv('a,b,c\n1,2,3\n');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    const result = parseCsv('date,description\n2024-01-01,"Coffee, Inc."\n');
    expect(result).toEqual([
      ['date', 'description'],
      ['2024-01-01', 'Coffee, Inc.'],
    ]);
  });

  it('handles escaped quotes', () => {
    const result = parseCsv('desc\n"He said ""hi"""\n');
    expect(result).toEqual([['desc'], ['He said "hi"']]);
  });

  it('handles newlines inside quoted fields', () => {
    const result = parseCsv('desc\n"line1\nline2"\n');
    expect(result).toEqual([['desc'], ['line1\nline2']]);
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a byte order mark', () => {
    const result = parseCsv('\uFEFFdate,amount\n2024-01-01,10\n');
    expect(result[0]).toEqual(['date', 'amount']);
  });

  it('drops fully empty rows', () => {
    const result = parseCsv('a,b\n1,2\n\n\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('detectHeaderRow', () => {
  it('detects a header when multiple cells match keywords', () => {
    const rows = [
      ['Date', 'Description', 'Amount'],
      ['2024-01-01', 'Coffee', '5.00'],
    ];
    expect(detectHeaderRow(rows)).toBe(true);
  });

  it('returns false for a data-only first row', () => {
    const rows = [
      ['2024-01-01', 'Coffee', '5.00'],
      ['2024-01-02', 'Rent', '1200.00'],
    ];
    expect(detectHeaderRow(rows)).toBe(false);
  });
});

describe('detectColumns', () => {
  it('maps a standard statement layout', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Category'];
    const { mapping, ambiguous } = detectColumns(headers);
    expect(ambiguous).toEqual([]);
    expect(mapping).toEqual({
      date: 0,
      merchant: 1,
      amount: null,
      debit: 2,
      credit: 3,
      type: null,
      category: 4,
      account: null,
      notes: null,
    });
  });

  it('maps a single amount column', () => {
    const headers = ['Posted Date', 'Merchant', 'Amount'];
    const { mapping, ambiguous } = detectColumns(headers);
    expect(ambiguous).toEqual([]);
    expect(mapping.amount).toBe(2);
    expect(mapping.debit).toBeNull();
  });

  it('reports ambiguity when merchant is missing', () => {
    const headers = ['Date', 'Amount'];
    const { ambiguous } = detectColumns(headers);
    expect(ambiguous).toContain('merchant');
  });

  it('reports ambiguity when no amount source exists', () => {
    const headers = ['Date', 'Description', 'Reference'];
    const { ambiguous } = detectColumns(headers);
    expect(ambiguous).toContain('amount');
  });

  it('reports ambiguity when both amount and debit exist', () => {
    const headers = ['Date', 'Description', 'Amount', 'Debit'];
    const { ambiguous } = detectColumns(headers);
    expect(ambiguous).toContain('amount');
  });

  it('does not treat an account-number column as the account', () => {
    const headers = ['Date', 'Description', 'Amount', 'Account Number'];
    const { mapping, ambiguous } = detectColumns(headers);
    expect(ambiguous).toEqual([]);
    expect(mapping.account).toBeNull();
  });

  it('maps a Type column before merchant so it is not claimed by the description', () => {
    const headers = [
      'Date',
      'Transaction Details',
      'Type',
      'Amount',
      'Account',
      'Notes',
      'Category',
    ];
    const { mapping, ambiguous } = detectColumns(headers);
    expect(ambiguous).toEqual([]);
    expect(mapping.type).toBe(2);
    expect(mapping.merchant).toBe(1);
    expect(mapping.amount).toBe(3);
  });

  it('treats Transaction Type as the type role', () => {
    const headers = ['Date', 'Description', 'Transaction Type', 'Amount'];
    const { mapping } = detectColumns(headers);
    expect(mapping.type).toBe(2);
    expect(mapping.merchant).toBe(1);
  });
});

describe('guessDirectionValue', () => {
  it('maps expense synonyms', () => {
    expect(guessDirectionValue('Debit')).toBe('expense');
    expect(guessDirectionValue('DR')).toBe('expense');
    expect(guessDirectionValue('Withdrawal')).toBe('expense');
    expect(guessDirectionValue('Paid Out')).toBe('expense');
    expect(guessDirectionValue('Money Out')).toBe('expense');
    expect(guessDirectionValue('Expense')).toBe('expense');
    expect(guessDirectionValue('Payment')).toBe('expense');
  });

  it('maps income synonyms', () => {
    expect(guessDirectionValue('Credit')).toBe('income');
    expect(guessDirectionValue('CR')).toBe('income');
    expect(guessDirectionValue('Deposit')).toBe('income');
    expect(guessDirectionValue('Paid In')).toBe('income');
    expect(guessDirectionValue('Money In')).toBe('income');
    expect(guessDirectionValue('Income')).toBe('income');
    expect(guessDirectionValue('Receipt')).toBe('income');
  });

  it('normalizes case and whitespace', () => {
    expect(guessDirectionValue('  debit  ')).toBe('expense');
    expect(guessDirectionValue('CR')).toBe('income');
  });

  it('returns null for unknown tokens', () => {
    expect(guessDirectionValue('Refund')).toBeNull();
    expect(guessDirectionValue('')).toBeNull();
  });
});

describe('detectDirection', () => {
  const rows = [
    ['2024-01-05', 'Coffee', 'Debit', '5.50'],
    ['2024-01-06', 'Coffee', 'Debit', '6.00'],
    ['2024-01-07', 'Paycheck', 'Credit', '2500.00'],
  ];

  it('detects two values and guesses debit as expense', () => {
    expect(detectDirection(rows, 2)).toEqual({
      values: ['debit', 'credit'],
      guess: { expense: 'debit', income: 'credit' },
      ambiguous: false,
    });
  });

  it('returns a guess regardless of column order', () => {
    const flipped = rows.map(([d, m, t, a]) => [
      d,
      m,
      t === 'Debit' ? 'Credit' : 'Debit',
      a,
    ]);
    const result = detectDirection(flipped, 2);
    expect(result.guess).toEqual({ expense: 'debit', income: 'credit' });
  });

  it('is ambiguous when more than two distinct values exist', () => {
    const withRefund = [...rows, ['2024-01-08', 'Shop', 'Refund', '10.00']];
    const result = detectDirection(withRefund, 2);
    expect(result.guess).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.values).toEqual(['debit', 'credit', 'refund']);
  });

  it('is ambiguous when only one distinct value exists', () => {
    const single = [rows[0]];
    const result = detectDirection(single, 2);
    expect(result.guess).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it('is ambiguous when neither value matches a synonym', () => {
    const custom = [
      ['2024-01-05', 'A', 'Incoming', '5.00'],
      ['2024-01-06', 'A', 'Outgoing', '5.00'],
    ];
    const result = detectDirection(custom, 2);
    expect(result.guess).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.values).toEqual(['incoming', 'outgoing']);
  });

  it('ignores empty type cells', () => {
    const withBlank = [...rows, ['2024-01-08', 'Shop', '', '10.00']];
    const result = detectDirection(withBlank, 2);
    expect(result.ambiguous).toBe(false);
  });
});

describe('normalizeDate', () => {
  it('normalizes ISO dates', () => {
    expect(normalizeDate('2024-01-15')).toBe('2024-01-15');
  });

  it('normalizes MM/DD/YYYY', () => {
    expect(normalizeDate('01/15/2024')).toBe('2024-01-15');
  });

  it('normalizes DD/MM/YYYY', () => {
    expect(normalizeDate('15/01/2024')).toBe('2024-01-15');
  });

  it('auto-detects day-first when the first part cannot be a month', () => {
    expect(normalizeDate('13/01/2024')).toBe('2024-01-13');
  });

  it('normalizes YYYY/MM/DD with dots', () => {
    expect(normalizeDate('2024.01.15')).toBe('2024-01-15');
  });

  it('expands two-digit years', () => {
    expect(normalizeDate('1/15/24')).toBe('2024-01-15');
    expect(normalizeDate('1/15/99')).toBe('1999-01-15');
  });

  it('normalizes day-month-name formats', () => {
    expect(normalizeDate('15 Jan 2024')).toBe('2024-01-15');
    expect(normalizeDate('Jan 15, 2024')).toBe('2024-01-15');
  });

  it('rejects invalid calendar dates', () => {
    expect(normalizeDate('02/30/2024')).toBeNull();
    expect(normalizeDate('13/13/2024')).toBeNull();
    expect(normalizeDate('31/04/2024')).toBeNull();
  });

  it('rejects non-date values', () => {
    expect(normalizeDate('N/A')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('12.34')).toBe(12.34);
  });

  it('parses negative numbers', () => {
    expect(parseAmount('-12.34')).toBe(-12.34);
  });

  it('parses parenthesized negatives', () => {
    expect(parseAmount('(12.34)')).toBe(-12.34);
  });

  it('parses currency symbols', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('€12,34')).toBe(12.34);
  });

  it('parses European decimal separators', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('12,34')).toBe(12.34);
  });

  it('parses thousands separators without decimals', () => {
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('12,345,678')).toBe(12345678);
  });

  it('returns null for unparseable values', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('--')).toBeNull();
  });
});
