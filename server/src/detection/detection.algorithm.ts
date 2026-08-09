import type { Cadence, Transaction } from '../database/schema';
import { normalizeMerchant } from '../common/merchant';
import type { DetectionSuggestion } from './detection.types';

export interface HintResult {
  kind: 'subscription' | 'recurring';
  hasHint: boolean;
}

interface CadenceWindow {
  min: number;
  max: number;
  nominal: number;
}

export const CADENCE_WINDOWS: Record<Cadence, CadenceWindow> = {
  weekly: { min: 5, max: 9, nominal: 7 },
  biweekly: { min: 12, max: 17, nominal: 14 },
  monthly: { min: 24, max: 40, nominal: 30 },
  quarterly: { min: 75, max: 110, nominal: 90 },
  annual: { min: 330, max: 400, nominal: 365 },
};

const SUBSCRIPTION_HINTS = [
  'netflix',
  'spotify',
  'hulu',
  'disney',
  'youtube',
  'icloud',
  'dropbox',
  'adobe',
  'microsoft',
  'amazon prime',
  'patreon',
  'membership',
  'studio',
  'gym',
  'openai',
  'chatgpt',
  'canva',
  'notion',
  'zoom',
  'slack',
  'github',
];

const RECURRING_HINTS = [
  'mortgage',
  'rent',
  'loan',
  'insurance',
  'utility',
  'utilities',
  'electric',
  'water',
  'internet',
  'phone',
  'mobile',
  'daycare',
  'tuition',
  'lease',
  'car payment',
  'auto payment',
  'hoa',
  'property tax',
];

const CADENCE_ORDER: Cadence[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
];

const NO_HINT_CADENCES: Cadence[] = ['monthly', 'quarterly', 'annual'];

const SUBSCRIPTION_VARIATION_LIMIT = 0.2;
const RECURRING_VARIATION_LIMIT = 0.35;
const NO_HINT_VARIATION_LIMIT = 0.03;
const NO_HINT_MIN_OCCURRENCES = 3;

const MONTHLY_EQUIVALENTS: Record<Cadence, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

function parseISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000,
  );
}

export function gapsBetween(dates: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(daysBetween(dates[i - 1], dates[i]));
  }
  return gaps;
}

export function classifyCadence(dates: string[]): Cadence | null {
  const gaps = gapsBetween(dates);
  if (gaps.length === 0) {
    return null;
  }
  let best: Cadence | null = null;
  let bestCount = 0;
  for (const cadence of CADENCE_ORDER) {
    const window = CADENCE_WINDOWS[cadence];
    const count = gaps.filter(
      (gap) => gap >= window.min && gap <= window.max,
    ).length;
    if (count > bestCount) {
      bestCount = count;
      best = cadence;
    }
  }
  if (best === null || bestCount === 0) {
    return null;
  }
  if (bestCount / gaps.length < 0.5) {
    return null;
  }
  return best;
}

export function amountVariation(amounts: number[]): number {
  if (amounts.length < 2) {
    return 0;
  }
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (max === 0) {
    return 0;
  }
  return (max - min) / max;
}

export function intervalJitter(gaps: number[], cadence: Cadence): number {
  const window = CADENCE_WINDOWS[cadence];
  const fitting = gaps.filter((gap) => gap >= window.min && gap <= window.max);
  if (fitting.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(...fitting.map((gap) => Math.abs(gap - window.nominal)));
}

export function classifyHint(
  merchant: string,
  category: string,
  tags: string[],
): HintResult {
  const haystack = [merchant, category, ...tags].join(' ').toLowerCase();
  if (SUBSCRIPTION_HINTS.some((hint) => haystack.includes(hint))) {
    return { kind: 'subscription', hasHint: true };
  }
  if (RECURRING_HINTS.some((hint) => haystack.includes(hint))) {
    return { kind: 'recurring', hasHint: true };
  }
  return { kind: 'recurring', hasHint: false };
}

export function monthlyEquivalent(amount: number, cadence: Cadence): number {
  return amount * MONTHLY_EQUIVALENTS[cadence];
}

function addCadence(date: Date, cadence: Cadence): Date {
  switch (cadence) {
    case 'weekly': {
      const result = new Date(date);
      result.setDate(result.getDate() + 7);
      return result;
    }
    case 'biweekly': {
      const result = new Date(date);
      result.setDate(result.getDate() + 14);
      return result;
    }
    case 'monthly':
    case 'quarterly':
    case 'annual': {
      const months =
        cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12;
      const result = new Date(date.getFullYear(), date.getMonth(), 1);
      result.setMonth(result.getMonth() + months);
      const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0,
      ).getDate();
      result.setDate(Math.min(date.getDate(), lastDay));
      return result;
    }
  }
}

export function nextExpectedDate(
  lastDate: string,
  cadence: Cadence,
  today: string,
): string {
  const todayTime = parseISO(today).getTime();
  let current = addCadence(parseISO(lastDate), cadence);
  let guard = 0;
  while (current.getTime() < todayTime && guard < 24) {
    current = addCadence(current, cadence);
    guard++;
  }
  return localDateISO(current);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = values[0];
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function detectSuggestions(
  expenses: Transaction[],
  exclusions: Set<string>,
): DetectionSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of expenses) {
    if (tx.type !== 'expense') {
      continue;
    }
    const key = normalizeMerchant(tx.merchant);
    if (!key) {
      continue;
    }
    const group = groups.get(key);
    if (group) {
      group.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  const suggestions: DetectionSuggestion[] = [];

  for (const [key, group] of groups) {
    if (exclusions.has(key)) {
      continue;
    }
    const uniqueDates = [...new Set(group.map((tx) => tx.date))].sort();
    if (uniqueDates.length < 2) {
      continue;
    }
    const cadence = classifyCadence(uniqueDates);
    if (cadence === null) {
      continue;
    }

    const amounts = group.map((tx) => tx.amount);
    const variation = amountVariation(amounts);
    const category = mostCommon(group.map((tx) => tx.category));
    const tags = [...new Set(group.flatMap((tx) => tx.tags ?? []))];
    const hint = classifyHint(key, category, tags);

    let accepted = true;
    if (hint.hasHint) {
      const limit =
        hint.kind === 'subscription'
          ? SUBSCRIPTION_VARIATION_LIMIT
          : RECURRING_VARIATION_LIMIT;
      if (variation > limit) {
        accepted = false;
      }
    } else {
      if (!NO_HINT_CADENCES.includes(cadence)) {
        accepted = false;
      }
      if (group.length < NO_HINT_MIN_OCCURRENCES) {
        accepted = false;
      }
      if (variation > NO_HINT_VARIATION_LIMIT) {
        accepted = false;
      }
    }
    if (!accepted) {
      continue;
    }

    const gaps = gapsBetween(uniqueDates);
    const jitter = intervalJitter(gaps, cadence);
    const averageAmount = round2(
      amounts.reduce((sum, value) => sum + value, 0) / amounts.length,
    );
    const confidence =
      group.length >= 3 && variation <= 0.12 && jitter <= 5 ? 'high' : 'likely';
    const lastDate = uniqueDates[uniqueDates.length - 1];
    const today = localDateISO(new Date());
    const accounts = group
      .map((tx) => tx.account)
      .filter((account) => account && account.length > 0);

    suggestions.push({
      key,
      merchant: mostCommon(group.map((tx) => tx.merchant)),
      category,
      account: accounts.length > 0 ? mostCommon(accounts) : null,
      cadence,
      occurrenceCount: group.length,
      confidence,
      averageAmount,
      monthlyEquivalent: round2(monthlyEquivalent(averageAmount, cadence)),
      nextExpectedDate: nextExpectedDate(lastDate, cadence, today),
      kind: hint.kind,
    });
  }

  suggestions.sort(
    (a, b) =>
      b.monthlyEquivalent - a.monthlyEquivalent ||
      a.merchant.localeCompare(b.merchant),
  );
  return suggestions;
}
