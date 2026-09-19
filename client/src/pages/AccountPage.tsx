import { useMemo, useState } from "react";
import {
  Building2,
  Clock,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/ui/loading-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Account, AccountType, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

const TYPE_CONFIG: Record<
  AccountType,
  { icon: typeof Wallet; accent: string; soft: string; label: string }
> = {
  cash: {
    icon: Wallet,
    accent: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Cash",
  },
  credit: {
    icon: CreditCard,
    accent: "bg-red-500",
    soft: "bg-red-500/10 text-red-600 dark:text-red-400",
    label: "Credit",
  },
  investment: {
    icon: Building2,
    accent: "bg-purple-500",
    soft: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    label: "Investment",
  },
};

const TYPE_FILTERS: Array<{ value: AccountType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "investment", label: "Investment" },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function relativeActivity(date: string): string {
  const today = todayISO();
  if (date >= today) return "Today";
  if (date >= yesterdayISO()) return "Yesterday";
  return formatDate(date);
}

/**
 * Per-account change since the start of the current calendar month, plus the
 * most recent activity date. Mirrors the server's balance semantics
 * (income +, expense −, transfer/investment −from +to).
 */
function analyzeTransactions(rows: Transaction[], monthStart: string) {
  const deltaByName = new Map<string, number>();
  const lastActivityByName = new Map<string, string>();

  const apply = (tx: Transaction, name: string, sign: 1 | -1) => {
    if (tx.date >= monthStart) {
      deltaByName.set(
        name,
        (deltaByName.get(name) ?? 0) + sign * tx.amount,
      );
    }
    const previous = lastActivityByName.get(name);
    if (!previous || tx.date > previous) {
      lastActivityByName.set(name, tx.date);
    }
  };

  for (const tx of rows) {
    switch (tx.type) {
      case "income":
        if (tx.fromAccount) apply(tx, tx.fromAccount, 1);
        break;
      case "expense":
        if (tx.fromAccount) apply(tx, tx.fromAccount, -1);
        break;
      case "transfer":
      case "investment":
        if (tx.fromAccount) apply(tx, tx.fromAccount, -1);
        if (tx.toAccount) apply(tx, tx.toAccount, 1);
        break;
    }
  }

  return { deltaByName, lastActivityByName };
}

export default function AccountPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const accountsQuery = useQuery<Account[]>(() => api.accounts.list(), []);
  const balancesQuery = useQuery(
    () => api.investments.getAccountBalances(),
    [],
  );
  const txQuery = useQuery<Transaction[]>(() => api.transactions.list(), []);

  const [filter, setFilter] = useState<AccountType | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash" as AccountType });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("cash");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const monthStart = useMemo(() => `${todayISO().slice(0, 7)}-01`, []);

  const balanceMap = useMemo(() => {
    return new Map(
      (balancesQuery.data ?? []).map((b) => [b.accountId, b.balance]),
    );
  }, [balancesQuery.data]);

  const { deltaByName, lastActivityByName } = useMemo(
    () => analyzeTransactions(txQuery.data ?? [], monthStart),
    [txQuery.data, monthStart],
  );

  const status: "loading" | "error" | "success" =
    accountsQuery.status === "loading" ||
    balancesQuery.status === "loading" ||
    txQuery.status === "loading"
      ? "loading"
      : accountsQuery.status === "error" ||
          balancesQuery.status === "error" ||
          txQuery.status === "error"
        ? "error"
        : "success";

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const totalBalance = useMemo(() => {
    let sum = 0;
    for (const account of accounts) {
      sum += balanceMap.get(account.id) ?? 0;
    }
    return sum;
  }, [accounts, balanceMap]);

  const totalChange = useMemo(() => {
    let sum = 0;
    for (const account of accounts) {
      sum += deltaByName.get(account.name) ?? 0;
    }
    return sum;
  }, [accounts, deltaByName]);

  const visibleAccounts = useMemo(
    () =>
      filter === "all"
        ? accounts
        : accounts.filter((account) => account.type === filter),
    [accounts, filter],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) {
      const name = editName.trim();
      if (!name) return;
      setSavingEdit(true);
      setEditError(null);
      try {
        await api.accounts.update(editing.id, { name, type: editType });
        setEditing(null);
        setEditName("");
        setOpen(false);
        accountsQuery.refetch();
        balancesQuery.refetch();
      } catch (err) {
        setEditError(message(err));
      } finally {
        setSavingEdit(false);
      }
      return;
    }
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await api.accounts.create(name, form.type);
      setForm({ name: "", type: "cash" });
      setOpen(false);
      accountsQuery.refetch();
      balancesQuery.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(account: Account) {
    setEditing(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditError(null);
    setOpen(true);
  }

  function closeSheet(open: boolean) {
    setOpen(open);
    if (!open) {
      setEditing(null);
      setEditName("");
      setEditType("cash");
      setEditError(null);
      setError(null);
    }
  }

  async function handleDelete(account: Account) {
    if (
      !window.confirm(
        `Delete "${account.name}"? Existing transactions keep the label.`,
      )
    ) {
      return;
    }
    setDeletingId(account.id);
    try {
      await api.accounts.remove(account.id);
      accountsQuery.refetch();
      balancesQuery.refetch();
    } catch (err) {
      window.alert(message(err));
    } finally {
      setDeletingId(null);
    }
  }

  const addCard = (dashed: boolean) => (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-card p-4 text-muted-foreground transition-colors hover:text-foreground",
        dashed
          ? "border-2 border-dashed hover:border-primary/40 hover:bg-muted/30"
          : "border hover:bg-muted/30",
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Plus className="size-5" />
      </div>
      <span className="text-sm font-medium">Add account</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Your cash, credit, and investment accounts at a glance.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Add account
        </Button>
      </div>

      {status === "loading" && <LoadingState label="Loading accounts…" />}
      {status === "error" && (
        <ErrorState
          message={
            accountsQuery.error?.message ??
            balancesQuery.error?.message ??
            txQuery.error?.message ??
            "Failed to load accounts."
          }
          onRetry={() => {
            accountsQuery.refetch();
            balancesQuery.refetch();
            txQuery.refetch();
          }}
        />
      )}

      {status === "success" && accounts.length === 0 && (
        <EmptyState
          icon={Landmark}
          title="No accounts yet"
          description="Add your first account to start tracking balances."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus />
              Add account
            </Button>
          }
        />
      )}

      {status === "success" && accounts.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p
                  className={cn(
                    "truncate text-base font-semibold tabular-nums tracking-tight",
                    totalBalance < 0 && "text-red-600 dark:text-red-400",
                  )}
                >
                  {formatCurrency(totalBalance, currency)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  totalChange >= 0
                    ? "bg-emerald-500/10"
                    : "bg-red-500/10",
                )}
              >
                {totalChange >= 0 ? (
                  <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="size-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">This month</p>
                <p
                  className={cn(
                    "truncate text-base font-semibold tabular-nums tracking-tight",
                    totalChange < 0 &&
                      "text-red-600 dark:text-red-400",
                  )}
                >
                  {totalChange >= 0
                    ? `+${formatCurrency(totalChange, currency)}`
                    : `-${formatCurrency(Math.abs(totalChange), currency)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Landmark className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Linked Accounts
                </p>
                <p className="truncate text-base font-semibold tabular-nums tracking-tight">
                  {accounts.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setFilter(pill.value)}
                aria-pressed={filter === pill.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === pill.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAccounts.map((account) => {
              const config = TYPE_CONFIG[account.type] ?? TYPE_CONFIG.cash;
              const Icon = config.icon;
              const balance = balanceMap.get(account.id) ?? 0;
              const delta = deltaByName.get(account.name) ?? 0;
              const previous = balance - delta;
              const percent =
                Math.abs(previous) > 0.005
                  ? (delta / Math.abs(previous)) * 100
                  : null;
              const lastActivity =
                lastActivityByName.get(account.name) ?? null;

              return (
                <div
                  key={account.id}
                  className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      config.accent,
                    )}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          config.soft,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">
                          {account.name}
                        </h3>
                        <p className="font-mono text-xs text-muted-foreground">
                          {config.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => startEdit(account)}
                        aria-label={`Edit ${account.name}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDelete(account)}
                        disabled={deletingId === account.id}
                        aria-label={`Delete ${account.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-xl font-bold tabular-nums tracking-tight",
                      account.type === "credit"
                        ? "text-red-600 dark:text-red-400"
                        : balance < 0 &&
                            "text-red-600 dark:text-red-400",
                    )}
                  >
                    {account.type === "credit"
                      ? formatCurrency(Math.abs(balance), currency)
                      : formatCurrency(balance, currency)}
                  </p>
                  {account.type === "credit" && balance !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      Outstanding balance
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {Math.abs(delta) > 0.005 ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          delta > 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400",
                        )}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        <span className="tabular-nums">
                          {delta > 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(delta), currency)}
                          {percent !== null &&
                            ` (${Math.abs(percent).toFixed(1)}%)`}
                        </span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        No change this month
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span className="shrink-0">
                        {lastActivity
                          ? relativeActivity(lastActivity)
                          : "No activity"}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
            {addCard(true)}
          </div>
        </>
      )}

      <Sheet open={open} onOpenChange={closeSheet}>
        <SheetContent side="right" className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <SheetHeader>
              <SheetTitle>{editing ? "Edit account" : "Add account"}</SheetTitle>
              <SheetDescription>
                {editing
                  ? "Update the name or type. Existing transactions keep their label."
                  : "Create a new cash, credit, or investment account."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Account name</label>
                <Input
                  value={editing ? editName : form.name}
                  onChange={(e) =>
                    editing
                      ? setEditName(e.target.value)
                      : setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Savings, Credit Card, Zerodha"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Type</label>
                <div
                  className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1"
                  role="group"
                  aria-label="Account type"
                >
                  {(Object.keys(TYPE_CONFIG) as AccountType[]).map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    const TypeIcon = cfg.icon;
                    const selected = editing ? editType === type : form.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          editing
                            ? setEditType(type)
                            : setForm((f) => ({ ...f, type }))
                        }
                        aria-pressed={selected}
                        className={cn(
                          "flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                          selected
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <TypeIcon className="size-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(editing ? editError : error) && (
                <p role="alert" className="text-xs text-destructive">
                  {editing ? editError : error}
                </p>
              )}
            </div>
            <SheetFooter>
              <Button type="submit" disabled={editing ? savingEdit : saving}>
                {editing
                  ? savingEdit
                    ? "Saving…"
                    : "Save changes"
                  : saving
                    ? "Creating…"
                    : "Create account"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}