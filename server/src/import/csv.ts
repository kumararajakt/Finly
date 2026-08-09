export type DateOrder = 'mdY' | 'dmY' | 'Ymd';
export type SignConvention = 'negative-expense' | 'negative-income';

export interface ColumnMapping {
  date: number;
  merchant: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
  account: number | null;
}

export interface ColumnDetection {
  mapping: ColumnMapping;
  ambiguous: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

type Role =
  'date' | 'merchant' | 'amount' | 'debit' | 'credit' | 'category' | 'account';

const KEYWORDS: Record<Role, string[]> = {
  date: [
    'date',
    'transaction date',
    'posted date',
    'date posted',
    'posting date',
    'value date',
    'booking date',
    'settlement date',
  ],
  merchant: [
    'merchant',
    'description',
    'payee',
    'narrative',
    'memo',
    'details',
    'particulars',
    'beneficiary',
    'counterparty',
    'transaction',
    'transaction name',
  ],
  amount: ['amount', 'amt', 'value', 'sum', 'total'],
  debit: [
    'debit',
    'withdrawal',
    'paid out',
    'money out',
    'moneyout',
    'expense',
  ],
  credit: ['credit', 'deposit', 'paid in', 'money in', 'moneyin', 'income'],
  category: [
    'category',
    'merchant category',
    'spend category',
    'spending category',
  ],
  account: ['account'],
};

const ROLE_ORDER: Role[] = [
  'date',
  'merchant',
  'category',
  'debit',
  'credit',
  'amount',
  'account',
];

function matchesKeywords(header: string, role: Role): boolean {
  const value = header.toLowerCase().trim();
  if (value.length === 0) {
    return false;
  }
  return KEYWORDS[role].some((keyword) => {
    if (keyword === 'account') {
      return value === 'account';
    }
    return value === keyword || value.includes(keyword);
  });
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i += 1;
      }
      row.push(field.trim());
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

export function detectHeaderRow(rows: string[][]): boolean {
  if (rows.length === 0) {
    return false;
  }
  const first = rows[0];
  const matched = first.filter((cell) => {
    const value = cell.toLowerCase().trim();
    return ROLE_ORDER.some((role) => matchesKeywords(value, role));
  });
  return matched.length >= 2;
}

export function detectColumns(headers: string[]): ColumnDetection {
  const assigned = new Map<Role, number>();
  const ambiguity: string[] = [];

  headers.forEach((header, index) => {
    const value = header.toLowerCase().trim();
    if (value.length === 0) {
      return;
    }
    for (const role of ROLE_ORDER) {
      if (assigned.has(role)) {
        continue;
      }
      if (matchesKeywords(value, role)) {
        assigned.set(role, index);
        break;
      }
    }
  });

  const date = assigned.get('date');
  if (date === undefined) {
    ambiguity.push('date');
  }

  const merchant = assigned.get('merchant');
  if (merchant === undefined) {
    ambiguity.push('merchant');
  }

  const amount = assigned.get('amount') ?? null;
  const debit = assigned.get('debit') ?? null;
  const credit = assigned.get('credit') ?? null;

  if (amount === null && debit === null && credit === null) {
    ambiguity.push('amount');
  } else if (amount !== null && (debit !== null || credit !== null)) {
    ambiguity.push('amount');
  }

  const mapping: ColumnMapping = {
    date: date ?? 0,
    merchant: merchant ?? 1,
    amount,
    debit,
    credit,
    category: assigned.get('category') ?? null,
    account: assigned.get('account') ?? null,
  };

  return { mapping, ambiguous: ambiguity };
}

export function detectDateOrder(
  rows: string[][],
  dateColumn: number,
): DateOrder {
  let mdY = 0;
  let dmY = 0;
  const pattern = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s*$/;
  for (const row of rows) {
    const value = row[dateColumn];
    if (value === undefined) {
      continue;
    }
    const match = pattern.exec(value);
    if (!match) {
      continue;
    }
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12) {
      dmY += 1;
    } else if (second > 12) {
      mdY += 1;
    }
  }
  if (dmY > mdY) {
    return 'dmY';
  }
  return 'mdY';
}

export function normalizeDate(value: string, order: DateOrder): string | null {
  const raw = value.trim();
  if (raw.length === 0) {
    return null;
  }

  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;

  const iso = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(raw);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
  if (slashed) {
    const first = Number(slashed[1]);
    const second = Number(slashed[2]);
    year = expandYear(Number(slashed[3]));
    if (order === 'Ymd') {
      month = first;
      day = second;
    } else if (order === 'dmY') {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }
    return validDate(year, month, day);
  }

  const monthName = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/.exec(raw);
  if (monthName) {
    day = Number(monthName[1]);
    month = MONTHS[monthName[2].toLowerCase()];
    year = expandYear(Number(monthName[3]));
    return validDate(year, month, day);
  }

  const monthNameLeading = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(
    raw,
  );
  if (monthNameLeading) {
    month = MONTHS[monthNameLeading[1].toLowerCase()];
    day = Number(monthNameLeading[2]);
    year = expandYear(Number(monthNameLeading[3]));
    return validDate(year, month, day);
  }

  return null;
}

function expandYear(value: number): number {
  if (value >= 100) {
    return value;
  }
  return value >= 70 ? 1900 + value : 2000 + value;
}

function validDate(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined,
): string | null {
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function parseAmount(value: string): number | null {
  const raw = value.trim();
  if (raw.length === 0) {
    return null;
  }
  let negative = false;
  let body = raw;
  if (body.startsWith('(') && body.endsWith(')')) {
    negative = true;
    body = body.slice(1, -1);
  }
  body = body.replace(/[$€£¥₹\s]/g, '');

  if (body.length === 0) {
    return null;
  }

  const dotCount = (body.match(/\./g) ?? []).length;
  const commaCount = (body.match(/,/g) ?? []).length;
  let normalized = body;
  if (dotCount > 0 && commaCount > 0) {
    if (body.lastIndexOf('.') > body.lastIndexOf(',')) {
      normalized = body.replace(/,/g, '');
    } else {
      normalized = body.replace(/\./g, '').replace(',', '.');
    }
  } else if (commaCount > 0 && dotCount === 0) {
    if (/(,\d{3}$)|(^\d{1,3}(,\d{3})+$)/.test(body)) {
      normalized = body.replace(/,/g, '');
    } else {
      normalized = body.replace(',', '.');
    }
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return negative ? -Math.abs(parsed) : parsed;
}
