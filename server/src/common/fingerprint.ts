import { createHash } from 'node:crypto';
import { normalizeMerchant } from './merchant';

export interface FingerprintInput {
  type: string;
  date: string;
  merchant: string;
  amount: number;
}

export function computeFingerprint(input: FingerprintInput): string {
  const amountCents = Math.round(input.amount * 100);
  const normalizedMerchant = normalizeMerchant(input.merchant);
  const value = `${input.type}|${input.date}|${normalizedMerchant}|${amountCents}`;
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
