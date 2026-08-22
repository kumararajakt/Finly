export type TransactionType = "expense" | "income" | "transfer" | "investment";
export type TransactionSource = "manual" | "csv" | "document" | "google-drive";
export type TradeSide = "buy" | "sell" | "dividend" | "interest";
export type AccountType = "cash" | "credit" | "investment";

export interface Trade {
  id: string;
  accountId: string;
  date: string;
  security: string;
  side: TradeSide;
  units: number;
  price: number;
  amount: number;
  fee: number;
  linkedTransactionId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Position {
  security: string;
  units: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPL: number | null;
}

export interface InvestmentSummary {
  totalInvested: number;
  realizedPL: number;
  marketValue: number | null;
  unrealizedPL: number | null;
}

export interface NetWorthBreakdown {
  cash: number;
  investments: number;
  credit: number;
  other: number;
}

export interface CreateTrade {
  accountId: string;
  date: string;
  security: string;
  side: TradeSide;
  units: number;
  price: number;
  fee?: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: TransactionType;
  fromAccount: string;
  toAccount: string | null;
  side: TradeSide | null;
  tags: string[];
  notes: string | null;
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
  type: AccountType;
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

export type Period = "all-time" | "this-month" | "last-month" | "last-3-months" | "last-6-months" | "this-year" | "custom";

export type Density = "compact" | "cozy" | "comfortable" | "roomy" | "spacious";

export interface Settings {
  selectedPeriod: Period;
  customDateFrom: string | null;
  customDateTo: string | null;
  netWorthAdjustment: number;
  currency: string;
  density: Density;
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

export type CsvRowStatus = "insert" | "duplicate" | "skipped";

export interface CsvRowPreview {
  date: string;
  merchant: string;
  amount: number;
  type: TransactionType;
  category: string;
  fromAccount: string;
  notes: string | null;
  status: CsvRowStatus;
}

export interface CsvImportPreview {
  rows: CsvRowPreview[];
  inserted: number;
  duplicates: number;
  skipped: number;
  needsReview: number;
  totalRows: number;
  newCategories: string[];
  newAccounts: string[];
}

export interface PdfExtractResult {
  csv: string;
  filename: string;
  pageCount: number;
}

export interface TransactionFilters {
  period?: Period;
  account?: string;
  category?: string;
  search?: string;
  type?: TransactionType;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  receipt?: boolean;
}

export interface NewTransaction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: TransactionType;
  fromAccount: string;
  toAccount?: string;
  tags?: string[];
  notes?: string;
  receipt?: boolean;
}

export type TransactionPatch = Partial<
  Pick<
    NewTransaction,
    "merchant" | "category" | "amount" | "date" | "type" | "fromAccount" | "toAccount" | "tags" | "notes"
  >
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
  netWorth: number;
  netWorthBreakdown: NetWorthBreakdown;
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
  notes: number | null;
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
  notes?: number;
  hasHeader?: boolean;
}

export interface TradeColumnMapping {
  date: number;
  security: number;
  side: number;
  units: number;
  price: number;
  amount?: number;
  fee?: number;
  account?: number;
  notes?: number;
  hasHeader?: boolean;
}

export interface TradeImportPreview {
  headers: string[];
  columnCount: number;
  sampleRows: string[][];
  rowCount: number;
  hasHeader: boolean;
  mapping: TradeColumnMapping;
  ambiguous: string[];
}

export interface TradeImportResult {
  inserted: number;
  skipped: number;
  totalRows: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  country: string | null;
  timeZone: string | null;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  timeZone: string;
}

export interface AuthMe {
  session: { id: string; expiresAt: string } | null;
  user: AuthUser | null;
}
