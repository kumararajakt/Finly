import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Target, Trash2 } from "lucide-react";
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
import {
  currentYearMonth,
  formatCurrency,
  monthLabelYM,
  shiftMonth,
} from "@/lib/format";
import type { Budget, Category } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function progressClass(pct: number, over: boolean): string {
  if (over) return "bg-destructive";
  if (pct >= 0.85) return "bg-amber-500";
  return "bg-emerald-500";
}

interface BudgetFormState {
  category: string;
  monthlyLimit: string;
  active: boolean;
}

function initialForm(initial: Budget | null): BudgetFormState {
  return {
    category: initial?.category ?? "",
    monthlyLimit: initial ? String(initial.monthlyLimit) : "",
    active: initial?.active ?? true,
  };
}

interface BudgetFormProps {
  initial: Budget | null;
  categories: Category[];
  onSaved: () => void;
  onDeleted: () => void;
}

function BudgetForm({ initial, categories, onSaved, onDeleted }: BudgetFormProps) {
  const [form, setForm] = useState<BudgetFormState>(() => initialForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm((f) => ({ ...f, category: categories[0].name }));
    }
  }, [categories, form.category]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyLimit = Number.parseFloat(form.monthlyLimit);
    if (!form.category) return setError("Please choose a category.");
    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0)
      return setError("Please enter a positive monthly limit.");

    setSaving(true);
    setError(null);
    try {
      const payload = { category: form.category, monthlyLimit, active: form.active };
      if (initial) {
        await api.budgets.update(initial.id, payload);
      } else {
        await api.budgets.create(payload);
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!window.confirm(`Delete the budget for "${initial.category}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.budgets.remove(initial.id);
      setDeleting(false);
      onDeleted();
    } catch (err) {
      setError(message(err));
      setDeleting(false);
    }
  }

  const knownCategory = form.category && !categories.some((c) => c.name === form.category);

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>{initial ? "Adjust budget" : "Create budget"}</SheetTitle>
        <SheetDescription>
          A monthly limit for one spending category.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
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
          <label className="text-xs font-medium">Monthly limit</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.monthlyLimit}
            onChange={(e) => setForm((f) => ({ ...f, monthlyLimit: e.target.value }))}
            placeholder="0.00"
            required
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="size-4"
          />
          <span className="text-sm">Active (counted in budget health)</span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-between">
        {initial ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 />
            {deleting ? "Deleting…" : "Delete budget"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create budget"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function BudgetsPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const [month, setMonth] = useState(() => currentYearMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const budgets = useQuery<Budget[]>(() => api.budgets.list(), []);
  const spending = useQuery<Record<string, number>>(() => api.budgets.spending(month), [month]);
  const categories = useQuery<Category[]>(() => api.categories.list(), []);

  const confirmed = budgets.data ?? [];
  const totals = spending.data ?? {};
  const active = confirmed.filter((b) => b.active);
  const currentMonth = currentYearMonth();

  const onTrack = active.filter((b) => (totals[b.category] ?? 0) <= b.monthlyLimit).length;
  const totalBudgeted = active.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = active.reduce((sum, b) => sum + (totals[b.category] ?? 0), 0);

  function openCreate() {
    setEditing(null);
    setMutationError(null);
    setAddOpen(true);
  }

  function openEdit(item: Budget) {
    setEditing(item);
    setMutationError(null);
    setAddOpen(true);
  }

  async function handleToggleActive(item: Budget) {
    setSavingId(item.id);
    setMutationError(null);
    try {
      const updated = await api.budgets.update(item.id, { active: !item.active });
      budgets.setData((list) => (list ?? []).map((b) => (b.id === updated.id ? updated : b)));
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  function handleSaved() {
    budgets.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  function handleDeleted() {
    budgets.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Budgets</h2>
          <p className="text-sm text-muted-foreground">
            Monthly limits by category, independent of the dashboard period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">
              {monthLabelYM(month)}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= currentMonth}
              aria-label="Next month"
            >
              <ChevronRight />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <Plus />
            Create budget
          </Button>
        </div>
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

      {budgets.status === "loading" && <LoadingState label="Loading budgets…" />}
      {budgets.status === "error" && (
        <ErrorState
          message={budgets.error?.message ?? "Failed to load budgets."}
          onRetry={budgets.refetch}
        />
      )}
      {budgets.status === "success" &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No budgets yet"
            description="Create a monthly limit for a category to start tracking spending against it."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Create budget
              </Button>
            }
          />
        ) : (
          <>
            {spending.status === "loading" && <LoadingState label="Loading spending…" />}
            {spending.status === "error" && (
              <ErrorState
                message={spending.error?.message ?? "Failed to load spending."}
                onRetry={spending.refetch}
              />
            )}
            {spending.status === "success" && (
              <>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="relative size-32 shrink-0">
                      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="currentColor"
                          strokeOpacity="0.12"
                          strokeWidth="11"
                          className="text-muted-foreground"
                        />
                        {active.length > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="11"
                            strokeLinecap="round"
                            className={cn(
                              "transition-colors",
                              onTrack === active.length
                                ? "text-emerald-500"
                                : onTrack / active.length >= 0.5
                                  ? "text-amber-500"
                                  : "text-destructive"
                            )}
                            strokeDasharray={`${(onTrack / active.length) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-semibold">
                          {active.length > 0 ? `${onTrack}/${active.length}` : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">on track</span>
                      </div>
                    </div>
                    <div className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
                      <p className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Total budgeted</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(totalBudgeted, currency)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Spent in {monthLabelYM(month)}</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(totalSpent, currency)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Remaining</span>
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            totalSpent > totalBudgeted ? "text-destructive" : "text-foreground"
                          )}
                        >
                          {formatCurrency(totalBudgeted - totalSpent, currency)}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Over budget</span>
                        <span className="font-medium tabular-nums">
                          {active.filter((b) => (totals[b.category] ?? 0) > b.monthlyLimit).length}{" "}
                          budget{active.filter((b) => (totals[b.category] ?? 0) > b.monthlyLimit).length === 1 ? "" : "s"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {confirmed.map((item) => {
                    const spent = totals[item.category] ?? 0;
                    const over = spent > item.monthlyLimit;
                    const pct = item.monthlyLimit > 0 ? spent / item.monthlyLimit : 0;
                    const barPct = Math.min(pct, 1);
                    return (
                      <div key={item.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.category}</span>
                              {!item.active && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Paused
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-medium tabular-nums text-foreground">
                                {formatCurrency(spent, currency)}
                              </span>{" "}
                              of {formatCurrency(item.monthlyLimit, currency)} budgeted
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={item.active}
                                disabled={savingId === item.id}
                                onChange={() => handleToggleActive(item)}
                                aria-label={`Toggle ${item.category} budget active`}
                                className="size-4"
                              />
                              Active
                            </label>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                              aria-label={`Adjust ${item.category} budget`}
                            >
                              <Pencil />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              progressClass(pct, over)
                            )}
                            style={{ width: `${Math.round(barPct * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="tabular-nums text-muted-foreground">
                            {Math.round(pct * 100)}%
                          </span>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              over ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            {over
                              ? `Over by ${formatCurrency(spent - item.monthlyLimit, currency)}`
                              : `${formatCurrency(item.monthlyLimit - spent, currency)} left`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ))}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <BudgetForm
            key={editing?.id ?? "new"}
            initial={editing}
            categories={categories.data ?? []}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
