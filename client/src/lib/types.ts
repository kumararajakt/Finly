export type TransactionType = "expense" | "income";
export type TransactionSource = "manual" | "csv" | "document" | "google-drive";

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: TransactionType;
  account: string;
  tags: string[];
  receipt: boolean;
  source: TransactionSource;
  fingerprint: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  createdAt: string;
}

export interface Tag {
  name: string;
  count: number;
}

export interface Rule {
  id: string;
  whenText: string;
  thenText: string;
  enabled: boolean;
  createdAt: string;
}

export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export interface Recurring {
  id: string;
  name: string;
  category: string;
  amount: number;
  cadence: Cadence;
  nextDate: string;
  account: string | null;
  active: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  cadence: Cadence;
  nextRenewal: string;
  account: string | null;
  active: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  active: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate: string | null;
  note: string | null;
  createdAt: string;
}

export type Period = "all-time" | "this-month" | "last-month" | "last-3-months" | "last-6-months" | "this-year";

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

export interface ImportResult {
  inserted: number;
  duplicates: number;
  skipped: number;
  needsReview: number;
  totalRows: number;
}

export interface TransactionFilters {
  period?: Period;
  account?: string;
  category?: string;
  search?: string;
}

export interface NewTransaction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: TransactionType;
  account: string;
  tags?: string[];
  receipt?: boolean;
}

export type TransactionPatch = Partial<
  Pick<NewTransaction, "merchant" | "category" | "amount" | "date" | "type" | "account" | "tags">
>;

export interface DetectionSuggestion {
  key: string;
  merchant: string;
  category: string;
  cadence: Cadence;
  occurrenceCount: number;
  confidence: "high" | "likely";
  averageAmount: number;
  monthlyEquivalent: number;
  nextExpectedDate: string;
  kind: "subscription" | "recurring";
}

export interface CashFlowPoint {
  label: string;
  income: number;
  spending: number;
}

export interface CategorySlice {
  category: string;
  amount: number;
  percentage: number;
}

export interface ComingUpItem {
  kind: "recurring" | "subscription";
  name: string;
  category: string;
  amount: number;
  date: string;
}

export interface Summary {
  period: Period;
  netWorth: number | null;
  income: number;
  spending: number;
  savingsRate: number;
  cashFlow: CashFlowPoint[];
  categoryBreakdown: CategorySlice[];
  recentActivity: Transaction[];
  comingUp: ComingUpItem[];
  needsReviewCount: number;
  pendingSuggestions: number;
  lastImport: ImportResult | null;
}

export type SignConvention = "negative-expense" | "negative-income";

export interface CsvColumnMapping {
  date: number;
  merchant: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
  account: number | null;
}

export interface CsvPreview {
  headers: string[];
  columnCount: number;
  sampleRows: string[][];
  rowCount: number;
  hasHeader: boolean;
  mapping: CsvColumnMapping;
  ambiguous: string[];
}

export interface CsvMapping {
  date: number;
  merchant: number;
  amount?: number;
  debit?: number;
  credit?: number;
  category?: number;
  account?: number;
  hasHeader?: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

export interface AuthMe {
  session: { id: string; expiresAt: string } | null;
  user: AuthUser | null;
}
