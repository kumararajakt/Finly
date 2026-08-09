import { useState } from "react";
import { Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/format";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface GoalFormState {
  name: string;
  targetAmount: string;
  currentAmount: string;
  dueDate: string;
  note: string;
}

function initialForm(initial: Goal | null): GoalFormState {
  return {
    name: initial?.name ?? "",
    targetAmount: initial ? String(initial.targetAmount) : "",
    currentAmount: initial ? String(initial.currentAmount) : "",
    dueDate: initial?.dueDate ?? "",
    note: initial?.note ?? "",
  };
}

interface GoalFormProps {
  initial: Goal | null;
  onSaved: () => void;
  onDeleted: () => void;
}

function GoalForm({ initial, onSaved, onDeleted }: GoalFormProps) {
  const [form, setForm] = useState<GoalFormState>(() => initialForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = Number.parseFloat(form.targetAmount);
    const currentAmount = form.currentAmount === "" ? 0 : Number.parseFloat(form.currentAmount);
    if (!form.name.trim()) return setError("Please enter a name.");
    if (!Number.isFinite(targetAmount) || targetAmount <= 0)
      return setError("Please enter a positive target amount.");
    if (!Number.isFinite(currentAmount) || currentAmount < 0)
      return setError("Current amount cannot be negative.");

    const payload = {
      name: form.name.trim(),
      targetAmount,
      currentAmount,
      dueDate: form.dueDate || null,
      note: form.note.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.goals.update(initial.id, payload);
      } else {
        await api.goals.create(payload);
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
    if (!window.confirm(`Delete the goal "${initial.name}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.goals.remove(initial.id);
      setDeleting(false);
      onDeleted();
    } catch (err) {
      setError(message(err));
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>{initial ? "Edit goal" : "Create goal"}</SheetTitle>
        <SheetDescription>
          A savings target with an optional due date and note.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Emergency fund"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Target amount</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.targetAmount}
              onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Current amount</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.currentAmount}
              onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Due date (optional)</label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Note (optional)</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            rows={3}
            placeholder="Add a note to yourself"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
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
            {deleting ? "Deleting…" : "Delete goal"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create goal"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function GoalsPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const goals = useQuery<Goal[]>(() => api.goals.list(), []);

  const confirmed = goals.data ?? [];
  const totalSaved = confirmed.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = confirmed.reduce((sum, g) => sum + g.targetAmount, 0);

  function openCreate() {
    setEditing(null);
    setMutationError(null);
    setAddOpen(true);
  }

  function openEdit(item: Goal) {
    setEditing(item);
    setMutationError(null);
    setAddOpen(true);
  }

  async function handleDelete(item: Goal) {
    if (!window.confirm(`Delete the goal "${item.name}"?`)) return;
    setMutationError(null);
    try {
      await api.goals.remove(item.id);
      goals.refetch();
    } catch (error) {
      setMutationError(message(error));
    }
  }

  function handleSaved() {
    goals.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  function handleDeleted() {
    goals.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Goals</h2>
          <p className="text-sm text-muted-foreground">
            Track progress toward savings targets.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Create goal
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

      {goals.status === "loading" && <LoadingState label="Loading goals…" />}
      {goals.status === "error" && (
        <ErrorState
          message={goals.error?.message ?? "Failed to load goals."}
          onRetry={goals.refetch}
        />
      )}
      {goals.status === "success" &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No goals yet"
            description="Create a savings goal to track progress toward a target."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Create goal
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">Saved toward goals</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(totalSaved, currency)}
                <span className="text-muted-foreground"> / {formatCurrency(totalTarget, currency)}</span>
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {confirmed.map((goal) => {
                const pct = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
                const barPct = Math.min(pct, 1);
                const met = pct >= 1;
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
                return (
                  <div key={goal.id} className="flex flex-col rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{goal.name}</span>
                          {met && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                              Goal met
                            </span>
                          )}
                        </div>
                        {goal.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{goal.note}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEdit(goal)}
                          aria-label={`Edit ${goal.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleDelete(goal)}
                          aria-label={`Delete ${goal.name}`}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between text-sm">
                      <span className="font-medium tabular-nums">
                        {formatCurrency(goal.currentAmount, currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        of {formatCurrency(goal.targetAmount, currency)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          met ? "bg-emerald-500" : "bg-primary"
                        )}
                        style={{ width: `${Math.round(barPct * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {Math.round(pct * 100)}%
                      </span>
                      <span className="font-medium tabular-nums">
                        {met
                          ? `Over target by ${formatCurrency(goal.currentAmount - goal.targetAmount, currency)}`
                          : `${formatCurrency(remaining, currency)} left to save`}
                      </span>
                    </div>
                    {goal.dueDate && (
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        Due {formatDate(goal.dueDate)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ))}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <GoalForm
            key={editing?.id ?? "new"}
            initial={editing}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
