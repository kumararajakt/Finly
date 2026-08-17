import { useEffect, useState } from "react";
import { CalendarClock, CreditCard, Pencil, Plus, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import ConfidenceBadge from "@/components/ConfidenceBadge";
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
import { CADENCES, cadenceLabel, monthlyEquivalent } from "@/lib/cadence";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Account, Cadence, Category, DetectionSuggestion, Subscription } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
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
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{suggestion.merchant}</span>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
        <p className="text-xs text-muted-foreground">
          {cadenceLabel(suggestion.cadence)} · {suggestion.occurrenceCount} payments ·{" "}
          {formatCurrency(suggestion.averageAmount, currency)} average · next renewal{" "}
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

interface SubscriptionRowProps {
  item: Subscription;
  currency: string;
  busy: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SubscriptionRow({ item, currency, busy, onToggleActive, onEdit, onDelete }: SubscriptionRowProps) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
          {item.category} · {cadenceLabel(item.cadence)} · next renewal {formatDate(item.nextRenewal)}
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

interface SubscriptionFormState {
  name: string;
  category: string;
  amount: string;
  cadence: Cadence;
  nextRenewal: string;
  account: string;
  active: boolean;
}

function initialForm(initial: Subscription | null): SubscriptionFormState {
  return {
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    amount: initial ? String(initial.amount) : "",
    cadence: initial?.cadence ?? "monthly",
    nextRenewal: initial?.nextRenewal ?? todayISO(),
    account: initial?.account ?? "",
    active: initial?.active ?? true,
  };
}

interface SubscriptionFormProps {
  initial: Subscription | null;
  categories: Category[];
  accounts: Account[];
  onSaved: () => void;
}

function SubscriptionForm({ initial, categories, accounts, onSaved }: SubscriptionFormProps) {
  const [form, setForm] = useState<SubscriptionFormState>(() => initialForm(initial));
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
    if (!form.name.trim()) return setError("Please enter a service name.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Please enter a positive amount.");
    if (!form.category) return setError("Please choose a category.");
    if (!form.nextRenewal) return setError("Please choose the next renewal date.");

    const payload = {
      name: form.name.trim(),
      category: form.category,
      amount,
      cadence: form.cadence,
      nextRenewal: form.nextRenewal,
      account: form.account || null,
      active: form.active,
    };

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.subscriptions.update(initial.id, payload);
      } else {
        await api.subscriptions.create(payload);
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
        <SheetTitle>{initial ? "Edit subscription" : "Add subscription"}</SheetTitle>
        <SheetDescription>
          A service you pay for on a schedule, like a streaming plan or software.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Service name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Netflix"
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
          <label className="text-xs font-medium">Next renewal date</label>
          <Input
            type="date"
            value={form.nextRenewal}
            onChange={(e) => setForm((f) => ({ ...f, nextRenewal: e.target.value }))}
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
          <span className="text-sm">Active (counted in totals)</span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add subscription"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function SubscriptionsPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const suggestions = useQuery<DetectionSuggestion[]>(() => api.detection.suggestions(), []);
  const subscriptions = useQuery<Subscription[]>(() => api.subscriptions.list(), []);
  const categories = useQuery<Category[]>(() => api.categories.list(), []);
  const accounts = useQuery<Account[]>(() => api.accounts.list(), []);

  const visibleSuggestions = (suggestions.data ?? []).filter((s) => s.kind === "subscription");
  const confirmed = subscriptions.data ?? [];
  const activeConfirmed = confirmed.filter((c) => c.active);

  const monthlyTotal =
    activeConfirmed.reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.cadence), 0) +
    visibleSuggestions.reduce((sum, s) => sum + s.monthlyEquivalent, 0);

  const nextRenewals = [
    ...activeConfirmed.map((c) => ({ name: c.name, amount: c.amount, date: c.nextRenewal })),
    ...visibleSuggestions.map((s) => ({
      name: s.merchant,
      amount: s.averageAmount,
      date: s.nextExpectedDate,
    })),
  ];
  const today = todayISO();
  const upcoming = nextRenewals.filter((p) => p.date >= today);
  const nextRenewal =
    upcoming.length > 0
      ? upcoming.reduce((a, b) => (a.date < b.date ? a : b))
      : nextRenewals.length > 0
        ? nextRenewals.reduce((a, b) => (a.date < b.date ? a : b))
        : null;

  function openCreate() {
    setEditing(null);
    setMutationError(null);
    setAddOpen(true);
  }

  function openEdit(item: Subscription) {
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
      subscriptions.refetch();
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

  async function handleToggleActive(item: Subscription) {
    setSavingId(item.id);
    setMutationError(null);
    try {
      const updated = await api.subscriptions.update(item.id, { active: !item.active });
      subscriptions.setData((list) =>
        (list ?? []).map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(item: Subscription) {
    if (!window.confirm(`Delete "${item.name}"? This does not delete matching transactions.`)) {
      return;
    }
    setSavingId(item.id);
    setMutationError(null);
    try {
      await api.subscriptions.remove(item.id);
      subscriptions.refetch();
      suggestions.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  function handleSaved() {
    subscriptions.refetch();
    suggestions.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Recurring services and memberships you pay for.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add subscription
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
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-destructive/20"
          >
            <X className="size-4" aria-hidden="true" />
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
                ? `Detection has run and found ${visibleSuggestions.length} subscription suggestion${
                    visibleSuggestions.length === 1 ? "" : "s"
                  } to review below.`
                : "Detection is monitoring your expense transactions for subscription patterns. No suggestions right now."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Monthly subscription total"
          value={formatCurrency(monthlyTotal, currency)}
          stripLabel="Confirmed + suggestions"
          stripValue={`${activeConfirmed.length} confirmed · ${visibleSuggestions.length} suggested`}
        />
        <SummaryCard
          label="Annual subscription total"
          value={formatCurrency(monthlyTotal * 12, currency)}
          stripLabel="Projected"
          stripValue="From current cadence"
        />
        <SummaryCard
          label="Next renewal"
          value={nextRenewal ? formatCurrency(nextRenewal.amount, currency) : "None"}
          stripLabel={nextRenewal ? nextRenewal.name : "Nothing scheduled"}
          stripValue={nextRenewal ? formatDate(nextRenewal.date) : "—"}
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
            <h3 className="text-sm font-medium">Detected subscriptions</h3>
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

      {subscriptions.status === "loading" && <LoadingState label="Loading subscriptions…" />}
      {subscriptions.status === "error" && (
        <ErrorState
          message={subscriptions.error?.message ?? "Failed to load subscriptions."}
          onRetry={subscriptions.refetch}
        />
      )}
      {subscriptions.status === "success" &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No subscriptions yet"
            description="Add a subscription manually, or keep a detected suggestion below to turn it into one."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Add subscription
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium">Confirmed subscriptions</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {confirmed.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {confirmed.map((item) => (
                <SubscriptionRow
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
          <SubscriptionForm
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
