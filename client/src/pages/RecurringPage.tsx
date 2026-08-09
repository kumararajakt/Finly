import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Repeat, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import SummaryCard from "@/components/SummaryCard";
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
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Account, Cadence, Category, DetectionSuggestion, Recurring } from "@/lib/types";
import { cn } from "@/lib/utils";

const CADENCES: Cadence[] = ["weekly", "biweekly", "monthly", "quarterly", "annual"];

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function cadenceLabel(cadence: Cadence): string {
  switch (cadence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annual":
      return "Annual";
  }
}

function monthlyEquivalent(amount: number, cadence: Cadence): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    case "monthly":
      return amount;
  }
}

function ConfidenceBadge({ confidence }: { confidence: DetectionSuggestion["confidence"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        confidence === "high"
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-amber-500/10 text-amber-600"
      )}
    >
      {confidence === "high" ? "High" : "Likely"}
    </span>
  );
}

interface SuggestionRowProps {
  suggestion: DetectionSuggestion;
  currency: string;
  busy: boolean;
  onKeep: () => void;
  onIgnore: () => void;
}

function SuggestionRow({ suggestion, currency, busy, onKeep, onIgnore }: SuggestionRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{suggestion.merchant}</span>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
        <p className="text-xs text-muted-foreground">
          {cadenceLabel(suggestion.cadence)} · {suggestion.occurrenceCount} payments ·{" "}
          {formatCurrency(suggestion.averageAmount, currency)} average · next{" "}
          {formatDate(suggestion.nextExpectedDate)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(suggestion.monthlyEquivalent, currency)}/mo
        </span>
        <Button size="sm" variant="outline" onClick={onIgnore} disabled={busy}>
          Ignore
        </Button>
        <Button size="sm" onClick={onKeep} disabled={busy}>
          Keep
        </Button>
      </div>
    </div>
  );
}

interface RecurringRowProps {
  item: Recurring;
  currency: string;
  busy: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RecurringRow({ item, currency, busy, onToggleActive, onEdit, onDelete }: RecurringRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {!item.active && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Paused
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {item.category} · {cadenceLabel(item.cadence)} · next {formatDate(item.nextDate)}
          {item.account ? ` · ${item.account}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={item.active}
            disabled={busy}
            onChange={onToggleActive}
            aria-label={`Toggle ${item.name} active`}
            className="size-4"
          />
          Active
        </label>
        <span className="w-24 text-right text-sm font-medium tabular-nums">
          {formatCurrency(item.amount, currency)}
        </span>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${item.name}`}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${item.name}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

interface RecurringFormState {
  name: string;
  category: string;
  amount: string;
  cadence: Cadence;
  nextDate: string;
  account: string;
  active: boolean;
}

function initialForm(initial: Recurring | null): RecurringFormState {
  return {
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    amount: initial ? String(initial.amount) : "",
    cadence: initial?.cadence ?? "monthly",
    nextDate: initial?.nextDate ?? todayISO(),
    account: initial?.account ?? "",
    active: initial?.active ?? true,
  };
}

interface RecurringFormProps {
  initial: Recurring | null;
  categories: Category[];
  accounts: Account[];
  onSaved: () => void;
}

function RecurringForm({ initial, categories, accounts, onSaved }: RecurringFormProps) {
  const [form, setForm] = useState<RecurringFormState>(() => initialForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm((f) => ({ ...f, category: categories[0].name }));
    }
  }, [categories, form.category]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number.parseFloat(form.amount);
    if (!form.name.trim()) return setError("Please enter a name.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Please enter a positive amount.");
    if (!form.category) return setError("Please choose a category.");
    if (!form.nextDate) return setError("Please choose the next payment date.");

    const payload = {
      name: form.name.trim(),
      category: form.category,
      amount,
      cadence: form.cadence,
      nextDate: form.nextDate,
      account: form.account || null,
      active: form.active,
    };

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.recurring.update(initial.id, payload);
      } else {
        await api.recurring.create(payload);
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  const knownCategory = form.category && !categories.some((c) => c.name === form.category);

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>{initial ? "Edit recurring payment" : "Add recurring payment"}</SheetTitle>
        <SheetDescription>
          A payment that repeats on a schedule, like rent or a gym membership.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Rent"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Amount</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Cadence</label>
            <select
              value={form.cadence}
              onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {CADENCES.map((cadence) => (
                <option key={cadence} value={cadence}>
                  {cadenceLabel(cadence)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Next payment date</label>
          <Input
            type="date"
            value={form.nextDate}
            onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {categories.length === 0 && (
                <option value="" disabled>
                  No categories yet
                </option>
              )}
              {knownCategory && <option value={form.category}>{form.category}</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Account</label>
            <select
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.name}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="size-4"
          />
          <span className="text-sm">Active (counted in commitments)</span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add payment"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function RecurringPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const suggestions = useQuery<DetectionSuggestion[]>(() => api.detection.suggestions(), []);
  const recurring = useQuery<Recurring[]>(() => api.recurring.list(), []);
  const categories = useQuery<Category[]>(() => api.categories.list(), []);
  const accounts = useQuery<Account[]>(() => api.accounts.list(), []);

  const visibleSuggestions = (suggestions.data ?? []).filter((s) => s.kind === "recurring");
  const confirmed = recurring.data ?? [];
  const activeConfirmed = confirmed.filter((c) => c.active);

  const monthlyTotal =
    activeConfirmed.reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.cadence), 0) +
    visibleSuggestions.reduce((sum, s) => sum + s.monthlyEquivalent, 0);

  const nextPayments = [
    ...activeConfirmed.map((c) => ({ name: c.name, amount: c.amount, date: c.nextDate })),
    ...visibleSuggestions.map((s) => ({
      name: s.merchant,
      amount: s.averageAmount,
      date: s.nextExpectedDate,
    })),
  ];
  const today = todayISO();
  const upcoming = nextPayments.filter((p) => p.date >= today);
  const nextPayment =
    upcoming.length > 0
      ? upcoming.reduce((a, b) => (a.date < b.date ? a : b))
      : nextPayments.length > 0
        ? nextPayments.reduce((a, b) => (a.date < b.date ? a : b))
        : null;

  function openCreate() {
    setEditing(null);
    setMutationError(null);
    setAddOpen(true);
  }

  function openEdit(item: Recurring) {
    setEditing(item);
    setMutationError(null);
    setAddOpen(true);
  }

  async function handleKeep(key: string) {
    setPendingKey(key);
    setMutationError(null);
    try {
      await api.detection.keep(key);
      suggestions.refetch();
      recurring.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleIgnore(key: string) {
    setPendingKey(key);
    setMutationError(null);
    try {
      await api.detection.ignore(key);
      suggestions.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleToggleActive(item: Recurring) {
    setSavingId(item.id);
    setMutationError(null);
    try {
      const updated = await api.recurring.update(item.id, { active: !item.active });
      recurring.setData((list) => (list ?? []).map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(item: Recurring) {
    if (!window.confirm(`Delete "${item.name}"? This does not delete matching transactions.`)) {
      return;
    }
    setSavingId(item.id);
    setMutationError(null);
    try {
      await api.recurring.remove(item.id);
      recurring.refetch();
      suggestions.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  function handleSaved() {
    recurring.refetch();
    suggestions.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recurring payments</h2>
          <p className="text-sm text-muted-foreground">
            Bills and payments that repeat on a schedule.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add recurring payment
        </Button>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 hover:bg-destructive/20"
          >
            <span className="block size-4">×</span>
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          visibleSuggestions.length > 0
            ? "border-primary/30 bg-primary/5"
            : "border-input bg-card"
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Active detection</p>
          <p className="text-sm text-muted-foreground">
            {suggestions.status === "error"
              ? "Detection is currently unavailable."
              : visibleSuggestions.length > 0
                ? `Detection has run and found ${visibleSuggestions.length} recurring payment suggestion${
                    visibleSuggestions.length === 1 ? "" : "s"
                  } to review below.`
                : "Detection is monitoring your expense transactions for recurring patterns. No suggestions right now."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Monthly commitment"
          value={formatCurrency(monthlyTotal, currency)}
          stripLabel="Confirmed + suggestions"
          stripValue={`${activeConfirmed.length} confirmed · ${visibleSuggestions.length} suggested`}
        />
        <SummaryCard
          label="Annual commitment"
          value={formatCurrency(monthlyTotal * 12, currency)}
          stripLabel="Projected"
          stripValue="From current cadence"
        />
        <SummaryCard
          label="Next payment"
          value={nextPayment ? formatCurrency(nextPayment.amount, currency) : "None"}
          stripLabel={nextPayment ? nextPayment.name : "Nothing scheduled"}
          stripValue={nextPayment ? formatDate(nextPayment.date) : "—"}
        />
      </div>

      {suggestions.status === "loading" && <LoadingState label="Checking for suggestions…" />}
      {suggestions.status === "error" && (
        <ErrorState
          message={suggestions.error?.message ?? "Failed to load detection suggestions."}
          onRetry={suggestions.refetch}
        />
      )}
      {suggestions.status === "success" && visibleSuggestions.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-medium">Detected recurring payments</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {visibleSuggestions.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {visibleSuggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.key}
                suggestion={suggestion}
                currency={currency}
                busy={pendingKey !== null}
                onKeep={() => handleKeep(suggestion.key)}
                onIgnore={() => handleIgnore(suggestion.key)}
              />
            ))}
          </div>
        </div>
      )}

      {recurring.status === "loading" && <LoadingState label="Loading recurring payments…" />}
      {recurring.status === "error" && (
        <ErrorState
          message={recurring.error?.message ?? "Failed to load recurring payments."}
          onRetry={recurring.refetch}
        />
      )}
      {recurring.status === "success" &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No recurring payments yet"
            description="Add a recurring payment manually, or keep a detected suggestion below to turn it into one."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Add recurring payment
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium">Confirmed recurring payments</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {confirmed.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {confirmed.map((item) => (
                <RecurringRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  busy={savingId === item.id}
                  onToggleActive={() => handleToggleActive(item)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          </div>
        ))}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <RecurringForm
            key={editing?.id ?? "new"}
            initial={editing}
            categories={categories.data ?? []}
            accounts={accounts.data ?? []}
            onSaved={handleSaved}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
