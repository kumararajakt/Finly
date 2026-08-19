import type { Period, TransactionType } from "./types";
import { tzOption } from "./timezone";

const DEFAULT_CURRENCY = "USD";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function calendarParts(
  date: Date
): { year: number; month: number; day: number } {
  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en", {
    ...tzOption(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function calendarInstant(parsed: { year: number; month: number; day: number }): Date {
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 11));
}

const formatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const key = currency || DEFAULT_CURRENCY;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: key,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(amount: number, currency = DEFAULT_CURRENCY): string {
  return getCurrencyFormatter(currency).format(amount);
}

export function formatSignedAmount(amount: number, type: TransactionType, currency = DEFAULT_CURRENCY): string {
  const formatted = formatCurrency(amount, currency);
  if (type === "income") return `+${formatted}`;
  if (type === "transfer" || type === "investment") return formatted;
  return `-${formatted}`;
}

export function formatCompactCurrency(amount: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function todayISO(): string {
  const parts = calendarParts(new Date());
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatDate(date: string): string {
  const parsed = parseISODate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat(undefined, {
    ...tzOption(),
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(calendarInstant(parsed));
}

export function formatMonthYear(date: string): string {
  const parsed = parseISODate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat(undefined, {
    ...tzOption(),
    month: "long",
    year: "numeric",
  }).format(calendarInstant(parsed));
}

export function currentYearMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthLabelYM(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return ym;
  }
  return new Intl.DateTimeFormat(undefined, {
    ...tzOption(),
    month: "long",
    year: "numeric",
  }).format(calendarInstant({ year, month, day: 1 }));
}

export function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    ...tzOption(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

const PERIOD_LABELS: Record<Period, string> = {
  "all-time": "All time",
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "last-6-months": "Last 6 months",
  "this-year": "This year",
  custom: "Custom",
};

export const PERIODS: Period[] = [
  "all-time",
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "this-year",
  "custom",
];

export function periodLabel(period: Period): string {
  return PERIOD_LABELS[period];
}

export function periodStartDate(period: Period, now = new Date()): string | null {
  const { year, month } = calendarParts(now);

  let startMonth = month;
  let startYear = year;
  switch (period) {
    case "all-time":
    case "custom":
      return null;
    case "this-month":
      break;
    case "last-month":
      startMonth -= 1;
      break;
    case "last-3-months":
      startMonth -= 2;
      break;
    case "last-6-months":
      startMonth -= 5;
      break;
    case "this-year":
      startMonth = 1;
      break;
  }

  while (startMonth < 1) {
    startMonth += 12;
    startYear -= 1;
  }

  return `${startYear}-${pad2(startMonth)}-01`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
