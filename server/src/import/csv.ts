import { parse } from 'csv/sync';

export type SignConvention = 'negative-expense' | 'negative-income';

export interface ColumnMapping {
  date: number;
  merchant: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
  account: number | null;
  notes: number | null;
}

export interface TradeColumnMapping {
  date: number;
  security: number;
  side: number;
  units: number;
  price: number;
  amount: number | null;
  fee: number | null;
  account: number | null;
  notes: number | null;
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
  | 'date'
  | 'merchant'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'category'
  | 'account'
  | 'notes';

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
  notes: ['note', 'notes', 'remark', 'remarks', 'comment', 'comments'],
};

const ROLE_ORDER: Role[] = [
  'date',
  'merchant',
  'category',
  'debit',
  'credit',
  'amount',
  'account',
  'notes',
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
  const rawRecords = parse(text, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  return rawRecords.filter((r) => r.some((cell) => cell.length > 0));
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
    notes: assigned.get('notes') ?? null,
  };

  return { mapping, ambiguous: ambiguity };
}

export function normalizeDate(value: string): string | null {
  const raw = value.trim();
  if (raw.length === 0) {
    return null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(raw);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const ymd = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(raw);
  if (ymd) {
    return validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const dayName = /^(\d{1,2})[./\s]+([a-zA-Z]{3,9})\.?[./\s]+(\d{2,4})$/.exec(
    raw,
  );
  if (dayName) {
    const month = MONTHS[dayName[2].toLowerCase()];
    if (month === undefined) {
      return null;
    }
    return validDate(expandYear(Number(dayName[3])), month, Number(dayName[1]));
  }

  const nameDay = /^([a-zA-Z]{3,9})\.?[./\s]+(\d{1,2}),?[./\s]+(\d{2,4})$/.exec(
    raw,
  );
  if (nameDay) {
    const month = MONTHS[nameDay[1].toLowerCase()];
    if (month === undefined) {
      return null;
    }
    return validDate(expandYear(Number(nameDay[3])), month, Number(nameDay[2]));
  }

  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(raw);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = expandYear(Number(numeric[3]));
    if (first > 12) {
      return validDate(year, second, first);
    }
    return validDate(year, first, second);
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

type TradeRole =
  | 'date'
  | 'security'
  | 'side'
  | 'units'
  | 'price'
  | 'amount'
  | 'fee'
  | 'account'
  | 'notes';

const TRADE_KEYWORDS: Record<TradeRole, string[]> = {
  date: [
    'date',
    'transaction date',
    'trade date',
    'posting date',
    'value date',
  ],
  security: [
    'security',
    'symbol',
    'ticker',
    'stock',
    'fund',
    'instrument',
    'isin',
  ],
  side: [
    'side',
    'type',
    'action',
    'transaction type',
    'trade type',
    'buy/sell',
  ],
  units: ['units', 'quantity', 'qty', 'shares', 'shares qty', 'shares quantity'],
  price: ['price', 'unit price', 'price per unit', 'cost per share'],
  amount: ['amount', 'total', 'transaction amount', 'trade amount', 'value'],
  fee: ['fee', 'fees', 'commission', 'commissions', 'charges', 'cost'],
  account: ['account', 'investment account', 'portfolio'],
  notes: ['note', 'notes', 'remarks', 'description'],
};

const TRADE_ROLE_ORDER: TradeRole[] = [
  'date',
  'security',
  'side',
  'units',
  'price',
  'amount',
  'fee',
  'account',
  'notes',
];

function matchesTradeKeywords(header: string, role: TradeRole): boolean {
  const value = header.toLowerCase().trim();
  if (value.length === 0) {
    return false;
  }
  return TRADE_KEYWORDS[role].some((keyword) => {
    return value === keyword || value.includes(keyword);
  });
}

export interface TradeColumnDetection {
  mapping: TradeColumnMapping;
  ambiguous: string[];
}

export function detectTradeColumns(
  headers: string[],
): TradeColumnDetection {
  const assigned = new Map<TradeRole, number>();
  const ambiguity: string[] = [];

  headers.forEach((header, index) => {
    const value = header.toLowerCase().trim();
    if (value.length === 0) {
      return;
    }
    for (const role of TRADE_ROLE_ORDER) {
      if (assigned.has(role)) {
        continue;
      }
      if (matchesTradeKeywords(value, role)) {
        assigned.set(role, index);
        break;
      }
    }
  });

  const date = assigned.get('date');
  if (date === undefined) {
    ambiguity.push('date');
  }

  const security = assigned.get('security');
  if (security === undefined) {
    ambiguity.push('security');
  }

  const side = assigned.get('side');
  if (side === undefined) {
    ambiguity.push('side');
  }

  const units = assigned.get('units');
  if (units === undefined) {
    ambiguity.push('units');
  }

  const price = assigned.get('price');
  if (price === undefined) {
    ambiguity.push('price');
  }

  const mapping: TradeColumnMapping = {
    date: date ?? 0,
    security: security ?? 1,
    side: side ?? 2,
    units: units ?? 3,
    price: price ?? 4,
    amount: assigned.get('amount') ?? null,
    fee: assigned.get('fee') ?? null,
    account: assigned.get('account') ?? null,
    notes: assigned.get('notes') ?? null,
  };

  return { mapping, ambiguous: ambiguity };
}
