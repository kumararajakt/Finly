import type {
  Account,
  AccountType,
  AuthMe,
  AuthUser,
  Budget,
  Category,
  CategoryUsage,
  Country,
  CreateTrade,
  CsvImportPreview,
  CsvMapping,
  CsvPreview,
  DateOrder,
  DetectionSuggestion,
  Goal,
  ImportResult,
  InvestmentSummary,
  NewTransaction,
  Period,
  PdfExtractResult,
  Position,
  Recurring,
  Rule,
  Settings,
  SignConvention,
  Subscription,
  Summary,
  Tag,
  Trade,
  TradeColumnMapping,
  TradeImportPreview,
  TradeImportResult,
  Transaction,
  TransactionFilters,
  TransactionPatch,
  TransactionPeer,
} from "./types";
import { filenameFromDisposition, saveDownload } from "./download";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?.replace(/\/+$/, "") ?? "";

/** Turns a failed response into an `ApiError`, preserving the app's 401 redirect. */
async function apiError(response: Response): Promise<ApiError> {
  if (response.status === 401) {
    window.dispatchEvent(new Event("finly:unauthorized"));
  }
  let message = `Request failed with status ${response.status}`;
  let code: string | undefined;
  try {
    const data = (await response.json()) as { error?: { message?: string; code?: string } };
    if (data.error?.message) message = data.error.message;
    code = data.error?.code;
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  return new ApiError(message, response.status, code);
}

async function apiFetch<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  const { headers, body, ...rest } = options;
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Fetches a non-JSON response (a file download) and saves it to disk. */
async function apiDownload(path: string, fallbackFilename: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api${path}`, { credentials: "include" });
  if (!response.ok) {
    throw await apiError(response);
  }
  const filename = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename,
  );
  saveDownload(await response.blob(), filename);
  return filename;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  auth: {
    me: () => apiFetch<AuthMe>("/auth/me"),
    socialSignIn: (provider: "google" | "github") =>
      apiFetch<{ url: string }>("/auth/social", {
        method: "POST",
        body: { provider, callbackURL: window.location.origin },
      }),
    logout: () => apiFetch<{ success: true }>("/auth/logout", { method: "POST" }),
    deleteAccount: () =>
      apiFetch<{ success: true }>("/auth/account", { method: "DELETE" }),
    updateProfile: (patch: {
      name?: string;
      image?: string | null;
      country?: string | null;
      onboardingComplete?: boolean;
    }) => apiFetch<AuthUser>("/auth/profile", { method: "PATCH", body: patch }),
  },

  countries: {
    list: () => apiFetch<Country[]>("/countries"),
  },

  settings: {
    get: () => apiFetch<Settings>("/settings"),
    set: (key: string, value: string | number | boolean | string[] | null) =>
      apiFetch<Settings>(`/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: { value },
      }),
  },

  transactions: {
    list: (filters: TransactionFilters = {}) =>
      apiFetch<Transaction[]>(`/transactions${buildQuery({ ...filters })}`),
    categoriesInUse: (period?: Period) =>
      apiFetch<string[]>(`/transactions/categories${buildQuery({ period })}`),
    peers: (query: { merchant: string; category: string; excludeId?: string }) =>
      apiFetch<TransactionPeer[]>(`/transactions/peers${buildQuery({ ...query })}`),
    create: (data: NewTransaction) =>
      apiFetch<Transaction>("/transactions", { method: "POST", body: data }),
    update: (id: string, patch: TransactionPatch) =>
      apiFetch<Transaction>(`/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
      }),
    updateCategory: (ids: string[], category: string) =>
      apiFetch<Transaction[]>("/transactions", {
        method: "PATCH",
        body: { ids, category },
      }),
    remove: (id: string) =>
      apiFetch<void>(`/transactions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    removeMany: (ids: string[]) =>
      apiFetch<void>("/transactions", { method: "DELETE", body: { ids } }),
    exportCsv: (filters: TransactionFilters = {}) =>
      apiDownload(
        `/transactions/export${buildQuery({ ...filters })}`,
        "transactions.csv",
      ),
  },

  categories: {
    list: () => apiFetch<Category[]>("/categories"),
    create: (name: string) =>
      apiFetch<Category>("/categories", { method: "POST", body: { name } }),
    rename: (id: string, name: string) =>
      apiFetch<Category>(`/categories/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { name },
      }),
    remove: (id: string, moveTo?: string) =>
      apiFetch<void>(`/categories/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: moveTo ? { moveTo } : {},
      }),
    usage: (id: string) =>
      apiFetch<CategoryUsage>(`/categories/${encodeURIComponent(id)}/usage`),
  },

  accounts: {
    list: () => apiFetch<Account[]>("/accounts"),
    create: (name: string, type?: AccountType) =>
      apiFetch<Account>("/accounts", { method: "POST", body: { name, type } }),
    update: (id: string, patch: { name?: string; type?: AccountType }) =>
      apiFetch<Account>(`/accounts/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
    remove: (id: string) =>
      apiFetch<void>(`/accounts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  tags: {
    list: () => apiFetch<Tag[]>("/tags"),
    create: (name: string) => apiFetch<Tag>("/tags", { method: "POST", body: { name } }),
    remove: (name: string) =>
      apiFetch<void>(`/tags/${encodeURIComponent(name)}`, { method: "DELETE" }),
  },

  rules: {
    list: () => apiFetch<Rule[]>("/rules"),
    create: (data: { whenText: string; thenText: string; enabled: boolean }) =>
      apiFetch<Rule>("/rules", { method: "POST", body: data }),
    update: (id: string, patch: Partial<{ whenText: string; thenText: string; enabled: boolean }>) =>
      apiFetch<Rule>(`/rules/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
    remove: (id: string) => apiFetch<void>(`/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  recurring: {
    list: () => apiFetch<Recurring[]>("/recurring"),
    create: (data: Omit<Recurring, "id" | "createdAt">) =>
      apiFetch<Recurring>("/recurring", { method: "POST", body: data }),
    update: (id: string, patch: Partial<Omit<Recurring, "id" | "createdAt">>) =>
      apiFetch<Recurring>(`/recurring/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
    remove: (id: string) => apiFetch<void>(`/recurring/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  subscriptions: {
    list: () => apiFetch<Subscription[]>("/subscriptions"),
    create: (data: Omit<Subscription, "id" | "createdAt">) =>
      apiFetch<Subscription>("/subscriptions", { method: "POST", body: data }),
    update: (id: string, patch: Partial<Omit<Subscription, "id" | "createdAt">>) =>
      apiFetch<Subscription>(`/subscriptions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
      }),
    remove: (id: string) =>
      apiFetch<void>(`/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  budgets: {
    list: () => apiFetch<Budget[]>("/budgets"),
    create: (data: Omit<Budget, "id" | "createdAt">) =>
      apiFetch<Budget>("/budgets", { method: "POST", body: data }),
    update: (id: string, patch: Partial<Omit<Budget, "id" | "createdAt">>) =>
      apiFetch<Budget>(`/budgets/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
    remove: (id: string) => apiFetch<void>(`/budgets/${encodeURIComponent(id)}`, { method: "DELETE" }),
    spending: (month: string) =>
      apiFetch<Record<string, number>>(`/budgets/spending?month=${encodeURIComponent(month)}`),
  },

  goals: {
    list: () => apiFetch<Goal[]>("/goals"),
    create: (data: Omit<Goal, "id" | "createdAt">) =>
      apiFetch<Goal>("/goals", { method: "POST", body: data }),
    update: (id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) =>
      apiFetch<Goal>(`/goals/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
    remove: (id: string) => apiFetch<void>(`/goals/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  detection: {
    suggestions: () => apiFetch<DetectionSuggestion[]>("/detection/suggestions"),
    keep: (key: string) =>
      apiFetch<{ kind: string; id: string; name: string }>("/detection/keep", {
        method: "POST",
        body: { key },
      }),
    ignore: (key: string) =>
      apiFetch<{ success: true }>("/detection/ignore", {
        method: "POST",
        body: { key },
      }),
  },

  importCsv: {
    preview: (csv: string, mapping?: CsvMapping, dateOrder?: DateOrder) =>
      apiFetch<CsvPreview>("/import/csv/preview", {
        method: "POST",
        body: { csv, ...(mapping ? { mapping } : {}), ...(dateOrder ? { dateOrder } : {}) },
      }),
    previewRows: (
      csv: string,
      mapping: CsvMapping,
      signConvention: SignConvention,
      dateOrder: DateOrder
    ) =>
      apiFetch<CsvImportPreview>("/import/csv/preview-rows", {
        method: "POST",
        body: { csv, mapping, signConvention, dateOrder },
      }),
    run: (
      csv: string,
      mapping: CsvMapping,
      signConvention: SignConvention,
      dateOrder: DateOrder
    ) =>
      apiFetch<ImportResult>("/import/csv", {
        method: "POST",
        body: { csv, mapping, signConvention, dateOrder },
      }),
  },

  importPdf: {
    extract: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<PdfExtractResult>("/import/pdf", {
        method: "POST",
        body: form,
      });
    },
  },

  summary: {
    get: (period: Period) => apiFetch<Summary>(`/summary${buildQuery({ period })}`),
  },

  investments: {
    createTrade: (data: CreateTrade) =>
      apiFetch<Trade>("/investments/trades", { method: "POST", body: data }),
    listTrades: (params?: { accountId?: string; security?: string }) =>
      apiFetch<Trade[]>(`/investments/trades${buildQuery(params ?? {})}`),
    deleteTrade: (id: string) =>
      apiFetch<void>(`/investments/trades/${id}`, { method: "DELETE" }),
    getPositions: (params?: { accountId?: string }) =>
      apiFetch<Position[]>(`/investments/positions${buildQuery(params ?? {})}`),
    getSummary: (accountId?: string) =>
      apiFetch<InvestmentSummary>(`/investments/summary${buildQuery({ accountId })}`),
    getQuote: (q: string) =>
      apiFetch<{ symbol: string; price: number; source: string }>(`/investments/quote${buildQuery({ q })}`),
    refreshQuotes: () =>
      apiFetch<Array<{ security: string; price: number; source: string }>>("/investments/quotes/refresh", { method: "POST" }),
    getAccountBalances: () =>
      apiFetch<Array<{ accountId: string; name: string; type: string; balance: number }>>("/investments/balances"),
    updateSecurity: (name: string, currentPrice: number) =>
      apiFetch<{ name: string; currentPrice: number }>(`/investments/securities/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: { currentPrice },
      }),
    importTradesPreview: (
      csv: string,
      mapping?: TradeColumnMapping,
      dateOrder?: DateOrder
    ) =>
      apiFetch<TradeImportPreview>("/import/csv/trades/preview", {
        method: "POST",
        body: {
          csv,
          ...(mapping ? { mapping } : {}),
          ...(dateOrder ? { dateOrder } : {}),
        },
      }),
    importTrades: (
      csv: string,
      mapping: TradeColumnMapping,
      dateOrder: DateOrder
    ) =>
      apiFetch<TradeImportResult>("/import/csv/trades", {
        method: "POST",
        body: { csv, mapping, dateOrder },
      }),
  },
};
