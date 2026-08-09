import type { Period, TransactionType } from "./types";

const DEFAULT_CURRENCY = "USD";

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
  return type === "income" ? `+${formatted}` : `-${formatted}`;
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
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatMonthYear(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function currentYearMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthLabelYM(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const parsed = new Date(year, month - 1, 1);
  if (Number.isNaN(parsed.getTime())) return ym;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(parsed);
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
};

export const PERIODS: Period[] = [
  "all-time",
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "this-year",
];

export function periodLabel(period: Period): string {
  return PERIOD_LABELS[period];
}

export function periodStartDate(period: Period, now = new Date()): string | null {
  const year = now.getFullYear();
  const month = now.getMonth();

  const start = new Date(year, month, 1);
  switch (period) {
    case "all-time":
      return null;
    case "this-month":
      break;
    case "last-month":
      start.setMonth(month - 1);
      break;
    case "last-3-months":
      start.setMonth(month - 2);
      break;
    case "last-6-months":
      start.setMonth(month - 5);
      break;
    case "this-year":
      start.setMonth(0);
      break;
  }

  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
