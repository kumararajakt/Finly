import { monthRange } from './month-range';

describe('monthRange', () => {
  it('returns the first and last day of the month', () => {
    expect(monthRange('2026-08')).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
  });

  it('handles short months', () => {
    expect(monthRange('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('handles leap years', () => {
    expect(monthRange('2024-02')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
  });

  it('handles December', () => {
    expect(monthRange('2026-12')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
  });
});
