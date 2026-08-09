export type Period =
  | 'all-time'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year';

export interface ImportResult {
  inserted: number;
  duplicate: number;
  skipped: number;
  review: number;
}

export interface Settings {
  selectedPeriod: Period;
  netWorthConfigured: boolean;
  totalAssets: number;
  totalLiabilities: number;
  currency: string;
  dismissedPatterns: string[];
  googleDriveFolderName: string | null;
  googleDriveFolderId: string | null;
  googleDriveSchedule: string | null;
  googleDriveLastSync: string | null;
  googleDriveLastResult: ImportResult | null;
}
