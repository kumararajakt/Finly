import {
  detectColumns,
  detectHeaderRow,
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
