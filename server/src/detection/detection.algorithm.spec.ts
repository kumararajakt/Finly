import type { Transaction } from '../database/schema';
import {
  amountVariation,
  classifyCadence,
  classifyHint,
  detectSuggestions,
  intervalJitter,
  monthlyEquivalent,
  nextExpectedDate,
} from './detection.algorithm';

describe('detection.algorithm', () => {
  describe('classifyCadence', () => {
    it('classifies monthly dates', () => {
      expect(classifyCadence(['2026-01-15', '2026-02-15', '2026-03-15'])).toBe(
        'monthly',
      );
    });

    it('classifies weekly dates', () => {
      expect(classifyCadence(['2026-01-05', '2026-01-12', '2026-01-19'])).toBe(
        'weekly',
      );
    });

    it('classifies annual dates with a skipped year', () => {
      expect(classifyCadence(['2023-03-01', '2024-03-01', '2025-03-01'])).toBe(
        'annual',
      );
    });

    it('rejects irregular dates that fit no window', () => {
      expect(
        classifyCadence(['2026-01-01', '2026-01-11', '2026-03-12']),
      ).toBeNull();
    });

    it('requires at least two dates', () => {
      expect(classifyCadence(['2026-01-01'])).toBeNull();
    });
  });

  describe('amountVariation', () => {
    it('computes relative variation', () => {
      expect(amountVariation([10, 11])).toBeCloseTo(0.0909, 3);
    });

    it('returns zero for identical amounts', () => {
      expect(amountVariation([10, 10, 10])).toBe(0);
    });

    it('handles a single amount as stable', () => {
      expect(amountVariation([10])).toBe(0);
    });
  });

  describe('intervalJitter', () => {
    it('measures deviation from the nominal cadence', () => {
      // 30, 31 day gaps: both fit monthly (24-40), max deviation from 30 is 1
      expect(intervalJitter([30, 31], 'monthly')).toBe(1);
    });

    it('returns infinity when no gap fits the window', () => {
      expect(intervalJitter([60], 'weekly')).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('classifyHint', () => {
    it('detects subscription hints', () => {
      expect(classifyHint('netflix', 'Entertainment', []).kind).toBe(
        'subscription',
      );
      expect(classifyHint('gym', 'Health', []).kind).toBe('subscription');
    });

    it('detects recurring-bill hints', () => {
      expect(classifyHint('rent', 'Housing', []).kind).toBe('recurring');
      expect(classifyHint('electric', 'Utilities', ['bill']).kind).toBe(
        'recurring',
      );
    });

    it('returns no hint for ordinary merchants', () => {
      const result = classifyHint('grocery store', 'Groceries', []);
      expect(result.kind).toBe('recurring');
      expect(result.hasHint).toBe(false);
    });
  });

  describe('monthlyEquivalent', () => {
    it('converts weekly', () => {
      expect(monthlyEquivalent(52, 'weekly')).toBeCloseTo(52 * (52 / 12), 6);
    });
    it('converts biweekly', () => {
      expect(monthlyEquivalent(100, 'biweekly')).toBeCloseTo(
        100 * (26 / 12),
        6,
      );
    });
    it('keeps monthly', () => {
      expect(monthlyEquivalent(20, 'monthly')).toBe(20);
    });
    it('converts quarterly and annual', () => {
      expect(monthlyEquivalent(90, 'quarterly')).toBeCloseTo(30, 6);
      expect(monthlyEquivalent(1200, 'annual')).toBeCloseTo(100, 6);
    });
  });

  describe('nextExpectedDate', () => {
    it('advances monthly, preserving day-of-month', () => {
      expect(nextExpectedDate('2026-01-15', 'monthly', '2026-01-01')).toBe(
        '2026-02-15',
      );
    });

    it('clamps to the end of shorter months', () => {
      expect(nextExpectedDate('2026-01-31', 'monthly', '2026-01-01')).toBe(
        '2026-02-28',
      );
    });

    it('advances past today when the next occurrence is overdue', () => {
      expect(nextExpectedDate('2026-05-01', 'monthly', '2026-07-01')).toBe(
        '2026-07-01',
      );
    });

    it('advances weekly', () => {
      expect(nextExpectedDate('2026-08-01', 'weekly', '2026-08-01')).toBe(
        '2026-08-08',
      );
    });
  });

  function expense(
    partial: Partial<Transaction> & {
      merchant: string;
      date: string;
      amount: number;
    },
  ): Transaction {
    return {
      id: '00000000-0000-4000-8000-000000000000',
      ...partial,
      type: 'expense',
      category: partial.category ?? 'Needs review',
      fromAccount: partial.fromAccount ?? 'Checking',
      tags: partial.tags ?? [],
      receipt: false,
      source: 'manual',
      fingerprint: 'test',
      createdAt: new Date(),
    };
  }

  describe('detectSuggestions', () => {
    it('detects a stable monthly subscription', () => {
      const expenses = [
        expense({
          merchant: 'Netflix',
          date: '2026-06-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
        expense({
          merchant: 'NETFLIX',
          date: '2026-07-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
        expense({
          merchant: 'Netflix',
          date: '2026-08-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(1);
      const suggestion = suggestions[0];
      expect(suggestion.kind).toBe('subscription');
      expect(suggestion.cadence).toBe('monthly');
      expect(suggestion.confidence).toBe('high');
      expect(suggestion.occurrenceCount).toBe(3);
      expect(suggestion.monthlyEquivalent).toBe(15.99);
      expect(suggestion.key).toBe('netflix');
    });

    it('skips weekly grocery shopping without a hint', () => {
      const expenses = [
        expense({
          merchant: 'Whole Foods',
          date: '2026-08-02',
          amount: 80,
          category: 'Groceries',
        }),
        expense({
          merchant: 'Whole Foods',
          date: '2026-08-09',
          amount: 95,
          category: 'Groceries',
        }),
        expense({
          merchant: 'Whole Foods',
          date: '2026-08-16',
          amount: 88,
          category: 'Groceries',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(0);
    });

    it('suggests a no-hint monthly pattern only with stable amounts', () => {
      const expenses = [
        expense({
          merchant: 'Laundry Mate',
          date: '2026-06-01',
          amount: 40,
          category: 'Other',
        }),
        expense({
          merchant: 'Laundry Mate',
          date: '2026-07-01',
          amount: 40,
          category: 'Other',
        }),
        expense({
          merchant: 'Laundry Mate',
          date: '2026-08-01',
          amount: 40,
          category: 'Other',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBe('high');
    });

    it('rejects a no-hint pattern with varying amounts', () => {
      const expenses = [
        expense({
          merchant: 'Corner Shop',
          date: '2026-06-01',
          amount: 40,
          category: 'Other',
        }),
        expense({
          merchant: 'Corner Shop',
          date: '2026-07-01',
          amount: 52,
          category: 'Other',
        }),
        expense({
          merchant: 'Corner Shop',
          date: '2026-08-01',
          amount: 44,
          category: 'Other',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(0);
    });

    it('detects a recurring bill with hint despite two occurrences', () => {
      const expenses = [
        expense({
          merchant: 'Electric Co',
          date: '2026-07-10',
          amount: 84.2,
          category: 'Utilities',
        }),
        expense({
          merchant: 'Electric Co',
          date: '2026-08-10',
          amount: 91.7,
          category: 'Utilities',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].kind).toBe('recurring');
    });

    it('excludes kept or dismissed patterns', () => {
      const expenses = [
        expense({
          merchant: 'Rent',
          date: '2026-07-01',
          amount: 1200,
          category: 'Housing',
        }),
        expense({
          merchant: 'Rent',
          date: '2026-08-01',
          amount: 1200,
          category: 'Housing',
        }),
      ];
      expect(detectSuggestions(expenses, new Set())).toHaveLength(1);
      expect(detectSuggestions(expenses, new Set(['rent']))).toHaveLength(0);
    });

    it('separates subscription and recurring kinds into distinct suggestions', () => {
      const expenses = [
        expense({
          merchant: 'Netflix',
          date: '2026-06-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
        expense({
          merchant: 'Netflix',
          date: '2026-07-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
        expense({
          merchant: 'Netflix',
          date: '2026-08-15',
          amount: 15.99,
          category: 'Subscriptions',
        }),
        expense({
          merchant: 'Rent',
          date: '2026-06-01',
          amount: 1200,
          category: 'Housing',
        }),
        expense({
          merchant: 'Rent',
          date: '2026-07-01',
          amount: 1200,
          category: 'Housing',
        }),
      ];
      const suggestions = detectSuggestions(expenses, new Set());
      expect(suggestions).toHaveLength(2);
      expect(suggestions.find((s) => s.kind === 'subscription')?.key).toBe(
        'netflix',
      );
      expect(suggestions.find((s) => s.kind === 'recurring')?.key).toBe('rent');
    });
  });
});
