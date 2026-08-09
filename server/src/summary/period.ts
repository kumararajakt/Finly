import type { Period } from '../settings/settings.types';

export interface DateRange {
  start: string | null;
  end: string;
}

export interface Bucket {
  start: string;
  end: string;
  label: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function localDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function firstOfMonth(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return localDateISO(d);
}

function lastOfMonth(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex + 1, 0);
  return localDateISO(d);
}

export function periodRange(period: Period, now: Date = new Date()): DateRange {
  const today = localDateISO(now);
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'all-time':
      return { start: null, end: today };
    case 'this-month':
      return { start: firstOfMonth(year, month), end: today };
    case 'last-month':
      return {
        start: firstOfMonth(year, month - 1),
        end: lastOfMonth(year, month - 1),
      };
    case 'last-3-months':
      return {
        start: firstOfMonth(year, month - 3),
        end: lastOfMonth(year, month - 1),
      };
    case 'last-6-months':
      return {
        start: firstOfMonth(year, month - 6),
        end: lastOfMonth(year, month - 1),
      };
    case 'this-year':
      return { start: `${year}-01-01`, end: today };
  }
}

function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function monthsInclusive(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  return (e.year - s.year) * 12 + (e.month - s.month) + 1;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  return Math.round((e - s) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

function monthLabel(iso: string): string {
  const { year, month } = parseISO(iso);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function monthlyBuckets(start: string, end: string): Bucket[] {
  const buckets: Bucket[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  cursor.setDate(1);
  const endDate = new Date(`${end}T00:00:00`);

  while (cursor <= endDate) {
    const bucketStart = localDateISO(cursor);
    buckets.push({
      start: bucketStart,
      end: lastOfMonth(cursor.getFullYear(), cursor.getMonth()),
      label: monthLabel(bucketStart),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function equalWidthBuckets(
  start: string,
  end: string,
  count: number,
): Bucket[] {
  const totalDays = daysBetween(start, end) + 1;
  const width = Math.ceil(totalDays / count);
  const buckets: Bucket[] = [];

  for (let i = 0; i < count; i++) {
    const bucketStart = addDays(start, i * width);
    const bucketEnd = addDays(
      start,
      Math.min((i + 1) * width - 1, totalDays - 1),
    );
    const label =
      monthLabel(bucketStart) === monthLabel(bucketEnd)
        ? monthLabel(bucketStart)
        : `${monthLabel(bucketStart)} – ${monthLabel(bucketEnd)}`;
    buckets.push({ start: bucketStart, end: bucketEnd, label });
  }
  return buckets;
}

export function buildBuckets(
  range: DateRange,
  transactionDates: string[],
): Bucket[] {
  if (transactionDates.length === 0) {
    return [];
  }
  const start =
    range.start ?? transactionDates.reduce((a, b) => (a < b ? a : b));
  const months = monthsInclusive(start, range.end);
  if (months <= 7) {
    return monthlyBuckets(start, range.end);
  }
  return equalWidthBuckets(start, range.end, 7);
}
