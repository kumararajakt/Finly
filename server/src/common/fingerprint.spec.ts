import { computeFingerprint } from './fingerprint';

describe('computeFingerprint', () => {
  const base = {
    type: 'expense',
    date: '2026-08-09',
    merchant: 'Netflix',
    amount: 15.99,
  };

  it('produces a 64-character hex digest', () => {
    const digest = computeFingerprint(base);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for identical inputs', () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint(base));
  });

  it('is insensitive to decimal noise in the amount', () => {
    expect(computeFingerprint({ ...base, amount: 12.3 })).toBe(
      computeFingerprint({ ...base, amount: 12.3 }),
    );
    expect(computeFingerprint({ ...base, amount: 12.3 })).toBe(
      computeFingerprint({ ...base, amount: 12.3 }),
    );
    expect(computeFingerprint({ ...base, amount: 12.3 })).not.toBe(
      computeFingerprint({ ...base, amount: 12.31 }),
    );
  });

  it('normalizes the merchant before hashing', () => {
    expect(computeFingerprint({ ...base, merchant: 'NETFLIX' })).toBe(
      computeFingerprint({ ...base, merchant: 'Netflix.' }),
    );
  });

  it('changes when a dedup-relevant field changes', () => {
    const differentType = computeFingerprint({ ...base, type: 'income' });
    const differentDate = computeFingerprint({ ...base, date: '2026-08-10' });
    const differentMerchant = computeFingerprint({
      ...base,
      merchant: 'Spotify',
    });
    const differentAmount = computeFingerprint({ ...base, amount: 16.0 });
    const original = computeFingerprint(base);

    expect(differentType).not.toBe(original);
    expect(differentDate).not.toBe(original);
    expect(differentMerchant).not.toBe(original);
    expect(differentAmount).not.toBe(original);
  });

  it('rounds amounts to cents', () => {
    expect(computeFingerprint({ ...base, amount: 15.994 })).toBe(
      computeFingerprint({ ...base, amount: 15.99 }),
    );
  });
});
