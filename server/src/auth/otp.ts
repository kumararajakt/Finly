import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0');
}

export function hashOtp(email: string, otp: string): string {
  return createHash('sha256')
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest('hex');
}

export function otpMatches(
  email: string,
  otp: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashOtp(email, otp), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
