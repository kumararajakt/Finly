import type { Cadence } from '../database/schema';

export type DetectionKind = 'subscription' | 'recurring';
export type DetectionConfidence = 'high' | 'likely';

export interface DetectionSuggestion {
  key: string;
  merchant: string;
  category: string;
  account: string | null;
  cadence: Cadence;
  occurrenceCount: number;
  confidence: DetectionConfidence;
  averageAmount: number;
  monthlyEquivalent: number;
  nextExpectedDate: string;
  kind: DetectionKind;
}
