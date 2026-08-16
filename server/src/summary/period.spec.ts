import { buildBuckets, periodRange } from './period';

describe('periodRange', () => {
  const now = new Date(2026, 7, 15);

  it('all-time has no start and ends today', () => {
    expect(periodRange('all-time', now)).toEqual({
      start: null,
      end: '2026-08-15',
    });
  });

  it('this-month starts on the first of the month', () => {
    expect(periodRange('this-month', now)).toEqual({
      start: '2026-08-01',
      end: '2026-08-15',
    });
  });

  it('last-month covers the previous calendar month', () => {
    expect(periodRange('last-month', now)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
  });

  it('last-3-months covers the three preceding calendar months', () => {
    expect(periodRange('last-3-months', now)).toEqual({
      start: '2026-05-01',
      end: '2026-07-31',
    });
  });

  it('last-6-months covers the six preceding calendar months', () => {
    expect(periodRange('last-6-months', now)).toEqual({
      start: '2026-02-01',
      end: '2026-07-31',
    });
  });

  it('this-year starts on January 1st', () => {
    expect(periodRange('this-year', now)).toEqual({
      start: '2026-01-01',
      end: '2026-08-15',
    });
  });

  it('handles a year boundary for last-month', () => {
    const janNow = new Date(2026, 0, 10);
    expect(periodRange('last-month', janNow)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  it('custom period uses the provided dates', () => {
    expect(
      periodRange('custom', now, { start: '2026-03-01', end: '2026-04-15' }),
    ).toEqual({ start: '2026-03-01', end: '2026-04-15' });
  });

  it('custom period defaults a missing end to today', () => {
    expect(periodRange('custom', now, { start: '2026-01-01' })).toEqual({
      start: '2026-01-01',
      end: '2026-08-15',
    });
  });

  it('custom period with no dates is unbounded', () => {
    expect(periodRange('custom', now)).toEqual({
      start: null,
      end: '2026-08-15',
    });
  });
});

describe('buildBuckets', () => {
  it('returns an empty array when there are no transactions', () => {
    expect(buildBuckets({ start: null, end: '2026-08-15' }, [])).toEqual([]);
  });

  it('uses the earliest transaction as start for all-time', () => {
    const buckets = buildBuckets({ start: null, end: '2026-08-15' }, [
      '2026-03-05',
      '2026-08-01',
    ]);
    expect(buckets.length).toBe(6); // Mar, Apr, May, Jun, Jul, Aug
    expect(buckets[0].label).toBe('Mar 2026');
    expect(buckets[5].label).toBe('Aug 2026');
  });

  it('produces monthly buckets when the span is seven months or fewer', () => {
    const buckets = buildBuckets({ start: '2026-01-01', end: '2026-07-31' }, [
      '2026-01-10',
      '2026-07-20',
    ]);
    expect(buckets.length).toBe(7);
    expect(buckets.map((b) => b.label)).toEqual([
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
      'May 2026',
      'Jun 2026',
      'Jul 2026',
    ]);
  });

  it('produces seven equal-width buckets for longer spans', () => {
    const buckets = buildBuckets({ start: '2025-01-01', end: '2026-12-31' }, [
      '2025-01-15',
      '2026-12-15',
    ]);
    expect(buckets.length).toBe(7);
  });
});
