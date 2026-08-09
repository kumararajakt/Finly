import { normalizeMerchant } from './merchant';

describe('normalizeMerchant', () => {
  it('lowercases and trims', () => {
    expect(normalizeMerchant('  STARBUCKS  ')).toBe('starbucks');
  });

  it('removes terminal # followed by digits', () => {
    expect(normalizeMerchant('STARBUCKS #1234')).toBe('starbucks');
  });

  it('removes punctuation', () => {
    expect(normalizeMerchant('Netflix, Inc.')).toBe('netflix inc');
  });

  it('removes long reference-number digit sequences', () => {
    expect(normalizeMerchant('PAYMENT THANK YOU 1234567890')).toBe(
      'payment thank you',
    );
  });

  it('collapses whitespace', () => {
    expect(normalizeMerchant('amazon   prime')).toBe('amazon prime');
  });

  it('keeps short digit sequences like store names', () => {
    expect(normalizeMerchant('7-Eleven')).toBe('7 eleven');
  });
});
