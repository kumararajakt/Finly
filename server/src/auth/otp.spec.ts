import { generateOtp, hashOtp, normalizeEmail, otpMatches } from './otp';

describe('otp', () => {
  describe('generateOtp', () => {
    it('produces a six-digit zero-padded code', () => {
      for (let i = 0; i < 200; i++) {
        const otp = generateOtp();
        expect(otp).toMatch(/^\d{6}$/);
      }
    });

    it('produces varying codes', () => {
      const codes = new Set(Array.from({ length: 50 }, () => generateOtp()));
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Owner@Finly.LOCAL ')).toBe('owner@finly.local');
    });
  });

  describe('hashOtp / otpMatches', () => {
    it('matches the exact code and email', () => {
      const hash = hashOtp('owner@finly.local', '123456');
      expect(otpMatches('owner@finly.local', '123456', hash)).toBe(true);
    });

    it('is case/whitespace insensitive on the email', () => {
      const hash = hashOtp('owner@finly.local', '123456');
      expect(otpMatches('  OWNER@FINLY.LOCAL ', '123456', hash)).toBe(true);
    });

    it('rejects the wrong code', () => {
      const hash = hashOtp('owner@finly.local', '123456');
      expect(otpMatches('owner@finly.local', '654321', hash)).toBe(false);
    });

    it('rejects a code issued for another email', () => {
      const hash = hashOtp('other@finly.local', '123456');
      expect(otpMatches('owner@finly.local', '123456', hash)).toBe(false);
    });

    it('rejects a malformed hash', () => {
      expect(otpMatches('owner@finly.local', '123456', 'not-a-hash')).toBe(
        false,
      );
    });
  });
});
