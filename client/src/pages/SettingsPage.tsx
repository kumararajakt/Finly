import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Check,
  FolderOpen,
  LayoutGrid,
  Pencil,
  RotateCcw,
  Tags,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Category, CategoryUsage, Density, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function toAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[, ]/g, "");
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

interface ManagedItem {
  key: string;
  label: string;
  detail?: string;
}

interface ManagedListProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  list: () => Promise<ManagedItem[]>;
  add: (name: string) => Promise<void>;
  remove: (item: ManagedItem, moveTo?: string) => Promise<void>;
  rename?: (item: ManagedItem, name: string) => Promise<void>;
  /**
   * Takes over the delete flow instead of the plain confirm — used by categories,
   * which must ask where the existing transactions should move to. The callback
   * receives a `confirm` helper that runs the delete and resolves to an error
   * message, or null on success.
   */
  requestRemove?: (
    item: ManagedItem,
    confirm: (moveTo?: string) => Promise<string | null>,
  ) => void;
  /** Notified whenever the list loads, so parents can reuse it (e.g. for suggestions). */
  onLoaded?: (items: ManagedItem[]) => void;
  addLabel: string;
  addPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
}

function ManagedList({
  icon: Icon,
  title,
  list,
  add,
  remove,
  rename,
  requestRemove,
  onLoaded,
  addLabel,
  addPlaceholder,
  emptyTitle,
  emptyDescription,
}: ManagedListProps) {
  const query = useQuery<ManagedItem[]>(list, []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);

  useEffect(() => {
    if (query.status === "success") {
      onLoaded?.(query.data ?? []);
    }
  }, [query.status, query.data, onLoaded]);

  async function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await add(name);
      setDraft("");
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  /** Runs the delete and returns the error message, or null on success. */
  async function performRemove(
    item: ManagedItem,
    moveTo?: string
  ): Promise<string | null> {
    setBusyKey(item.key);
    setError(null);
    try {
      await remove(item, moveTo);
      query.refetch();
      return null;
    } catch (err) {
      return message(err);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemove(item: ManagedItem) {
    if (requestRemove) {
      requestRemove(item, (moveTo) => performRemove(item, moveTo));
      return;
    }
    if (!window.confirm(`Delete "${item.label}"? It will be removed from future selectors.`)) {
      return;
    }
    const failure = await performRemove(item);
    if (failure) {
      setError(failure);
    }
  }

  function startRename(item: ManagedItem) {
    setRenamingKey(item.key);
    setRenameDraft(item.label);
    setError(null);
  }

  function cancelRename() {
    setRenamingKey(null);
    setRenameDraft("");
  }

  async function handleRename(item: ManagedItem) {
    const name = renameDraft.trim();
    if (!name) return;
    setRenamingBusy(true);
    setError(null);
    try {
      await rename?.(item, name);
      setRenamingKey(null);
      setRenameDraft("");
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setRenamingBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center gap-1.5">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {query.status === "success" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {(query.data ?? []).length}
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={addPlaceholder}
          className="w-40 sm:w-48"
          aria-label={`${title} name`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!draft.trim() || saving}
        >
          {saving ? "Adding…" : addLabel}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {query.status === "loading" && <LoadingState label={`Loading ${title.toLowerCase()}…`} />}
      {query.status === "error" && (
        <ErrorState
          message={query.error?.message ?? `Failed to load ${title.toLowerCase()}.`}
          onRetry={query.refetch}
        />
      )}
      {query.status === "success" &&
        ((query.data ?? []).length === 0 ? (
          <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-3">
                {renamingKey === item.key ? (
                  <div className="flex w-full items-center gap-2">
                    <Input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleRename(item);
                        } else if (e.key === "Escape") {
                          cancelRename();
                        }
                      }}
                      placeholder="New name"
                      className="h-8 w-full"
                      aria-label={`Rename ${item.label}`}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleRename(item)}
                      disabled={!renameDraft.trim() || renamingBusy}
                      aria-label="Save rename"
                    >
                      <Check />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={cancelRename}
                      disabled={renamingBusy}
                      aria-label="Cancel rename"
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 truncate text-sm">{item.label}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      {item.detail && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                      {rename && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startRename(item)}
                          disabled={busyKey === item.key}
                          aria-label={`Rename ${item.label}`}
                        >
                          <Pencil />
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleRemove(item)}
                        disabled={busyKey === item.key}
                        aria-label={`Delete ${item.label}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

const USAGE_LABELS: { key: Exclude<keyof CategoryUsage, "name">; label: string }[] = [
  { key: "transactions", label: "transaction" },
  { key: "recurring", label: "recurring payment" },
  { key: "subscriptions", label: "subscription" },
  { key: "budgets", label: "budget" },
];

function usageCount(usage: CategoryUsage): number {
  return USAGE_LABELS.reduce((total, { key }) => total + usage[key], 0);
}

function usageSummary(usage: CategoryUsage): string {
  return USAGE_LABELS.filter(({ key }) => usage[key] > 0)
    .map(({ key, label }) => `${usage[key]} ${label}${usage[key] === 1 ? "" : "s"}`)
    .join(", ");
}

/**
 * Categories are referenced by name from transactions, so deleting one that is
 * still in use asks where those records should move to first. The target is
 * created on the server when it doesn't already exist.
 */
function CategoriesSection() {
  const [items, setItems] = useState<ManagedItem[]>([]);
  const [target, setTarget] = useState<ManagedItem | null>(null);
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<((moveTo?: string) => Promise<string | null>) | null>(null);

  const handleLoaded = useCallback((loaded: ManagedItem[]) => setItems(loaded), []);

  function closeDialog() {
    setTarget(null);
    setUsage(null);
    setMoveTo("");
    setError(null);
    setSubmitting(false);
    confirmRef.current = null;
  }

  async function handleRequestRemove(
    item: ManagedItem,
    confirm: (moveTo?: string) => Promise<string | null>
  ) {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const found = await api.categories.usage(item.key);
      if (usageCount(found) === 0) {
        if (!window.confirm(`Delete "${item.label}"? It will be removed from future selectors.`)) {
          return;
        }
        setError(await confirm());
        return;
      }
      confirmRef.current = confirm;
      setTarget(item);
      setUsage(found);
      setMoveTo("");
    } catch (err) {
      setError(message(err));
    } finally {
      setChecking(false);
    }
  }

  const trimmed = moveTo.trim();
  const sameAsTarget =
    target !== null && trimmed.toLowerCase() === target.label.toLowerCase();
  const canSubmit =
    target !== null && trimmed !== "" && !sameAsTarget && !submitting && !checking;

  async function handleMoveAndDelete() {
    const confirm = confirmRef.current;
    if (!confirm || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const failure = await confirm(trimmed);
    if (failure) {
      setError(failure);
      setSubmitting(false);
      return;
    }
    closeDialog();
  }

  return (
    <div className="flex flex-col gap-3">
      <ManagedList
        icon={FolderOpen}
        title="Categories"
        list={async (): Promise<ManagedItem[]> =>
          (await api.categories.list()).map((category: Category) => ({
            key: category.id,
            label: category.name,
          }))
        }
        add={async (name) => {
          await api.categories.create(name);
        }}
        remove={async (item, moveTo) => {
          await api.categories.remove(item.key, moveTo);
        }}
        rename={async (item, name) => {
          await api.categories.rename(item.key, name);
        }}
        requestRemove={handleRequestRemove}
        onLoaded={handleLoaded}
        addLabel="Add"
        addPlaceholder="New category name"
        emptyTitle="No categories yet"
        emptyDescription="Categories drive the pickers used across the app."
      />

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{usage?.name}&quot;?</DialogTitle>
            <DialogDescription>
              {usage
                ? `${usageSummary(usage)} still use this category. Choose where they should move to — it is created if it does not exist yet — and the category is deleted.`
                : "Choose where the existing records should move to."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-move-to" className="text-xs font-medium">
              Move to
            </label>
            <Input
              id="category-move-to"
              list="category-move-to-options"
              value={moveTo}
              onChange={(event) => setMoveTo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleMoveAndDelete();
                }
              }}
              placeholder="e.g. Other"
              aria-invalid={sameAsTarget}
              autoFocus
            />
            <datalist id="category-move-to-options">
              {items
                .filter((item) => item.key !== target?.key)
                .map((item) => (
                  <option key={item.key} value={item.label} />
                ))}
            </datalist>
            {sameAsTarget && (
              <p role="alert" className="text-xs text-destructive">
                Pick a different category than the one being deleted.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleMoveAndDelete()}
              disabled={!canSubmit}
            >
              {submitting ? "Moving…" : "Move and delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NetWorthSection() {
  const { settings, status, error, refetch, saveSetting } = useSettings();
  const [adjustmentInput, setAdjustmentInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "success") {
      setAdjustmentInput(settings.netWorthAdjustment ? String(settings.netWorthAdjustment) : "");
    }
  }, [status, settings.netWorthAdjustment]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const adjustment = toAmount(adjustmentInput);
  const preview =
    adjustment !== null
      ? formatCurrency(adjustment, settings.currency)
      : null;

  async function handleSave() {
    const adjustmentValue = toAmount(adjustmentInput);
    if (adjustmentValue === null) {
      setSaveError("Enter a valid number for the adjustment.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveSetting("netWorthAdjustment", adjustmentValue);
      setSaved(true);
    } catch (err) {
      setSaveError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="max-w-xl text-sm text-muted-foreground">
        Net worth is computed from your account balances. Use this field to add an
        adjustment for assets or liabilities you don't track as accounts (gold,
        property, EPF, etc.).
      </p>

      {status === "loading" ? (
        <LoadingState label="Loading settings…" />
      ) : status === "error" ? (
        <ErrorState
          message={error?.message ?? "Failed to load settings."}
          onRetry={refetch}
        />
      ) : (
        <div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <label className="text-xs font-medium" htmlFor="net-worth-adjustment">
              Other assets/liabilities adjustment
            </label>
            <Input
              id="net-worth-adjustment"
              type="text"
              inputMode="decimal"
              value={adjustmentInput}
              onChange={(e) => setAdjustmentInput(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Adjustment:{" "}
          <span className="font-semibold tabular-nums text-foreground">{preview ?? "—"}</span>
        </p>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Saved
            </span>
          )}
          {saveError && (
            <span role="alert" className="text-xs text-destructive">
              {saveError}
            </span>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || status !== "success"}
          >
            {saving ? "Saving…" : "Save adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "Densest layout — more rows fit on screen." },
  { value: "cozy", label: "Cozy", description: "Snug spacing with a little more room." },
  { value: "comfortable", label: "Comfortable", description: "Balanced spacing, the default." },
  { value: "roomy", label: "Roomy", description: "Extra breathing room between elements." },
  { value: "spacious", label: "Spacious", description: "Generous, relaxed layout." },
];

function DensitySection() {
  const { settings, status, error, refetch, saveSetting } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSelect(density: Density) {
    if (density === settings.density || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSetting("density", density);
    } catch (err) {
      setSaveError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="max-w-xl text-sm text-muted-foreground">
        Control how tightly content is packed across the app. Changes apply immediately.
      </p>

      {status === "loading" ? (
        <LoadingState label="Loading settings…" />
      ) : status === "error" ? (
        <ErrorState
          message={error?.message ?? "Failed to load settings."}
          onRetry={refetch}
        />
      ) : (
        <div
          className="flex flex-col gap-1 rounded-lg border bg-muted/50 p-1 sm:flex-row sm:flex-wrap"
          role="group"
          aria-label="Layout density"
        >
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => handleSelect(option.value)}
              aria-pressed={settings.density === option.value}
              title={option.description}
              className={cn(
                "h-8 rounded-md px-2.5 text-sm font-medium transition-colors sm:h-7 disabled:opacity-50",
                settings.density === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {saveError && (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      )}
    </div>
  );
}

function IgnoredSuggestionsSection() {
  const { settings, saveSetting } = useSettings();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const count = settings.dismissedPatterns.length;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function handleRestore() {
    if (
      !window.confirm(
        "Restore ignored suggestions? Previously ignored patterns will be suggested again on the Recurring and Subscriptions pages."
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSetting("dismissedPatterns", []);
      setSaved(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="max-w-xl text-sm text-muted-foreground">
        Patterns you've ignored on the Recurring and Subscriptions pages stay hidden until you
        restore them.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">
          {count === 0 ? (
            "No ignored suggestions."
          ) : (
            <>
              <span className="font-semibold tabular-nums">{count}</span>{" "}
              {count === 1 ? "ignored suggestion" : "ignored suggestions"}
            </>
          )}
        </span>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Restored
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs text-destructive">
              {error}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleRestore}
            disabled={saving || count === 0}
          >
            {saving ? "Restoring…" : "Restore ignored suggestions"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountSection() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirm.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="max-w-xl text-sm text-muted-foreground">
        Permanently deletes your account and every transaction, budget, goal, recurring
        payment, and setting. This cannot be undone.
      </p>
      <div>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 />
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes all of your data, including your Google sign-in.
              Type{" "}
              <span className="font-semibold text-foreground">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleDelete();
              }
            }}
            placeholder="Type DELETE to confirm"
            aria-label="Confirmation text"
            autoFocus
          />

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={!matches || busy}
            >
              {busy ? "Deleting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your net worth, categories, and tags.
        </p>
      </div>

      <Accordion>
        <AccordionItem value="net-worth">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
                Net worth
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <NetWorthSection />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="density">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
                Layout density
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <DensitySection />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="categories">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                Categories
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <CategoriesSection />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="tags">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Tags className="size-4 text-muted-foreground" aria-hidden="true" />
                Tags
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <ManagedList
              icon={Tags}
              title="Tags"
              list={async (): Promise<ManagedItem[]> =>
                (await api.tags.list()).map((tag: Tag) => ({
                  key: tag.name,
                  label: tag.name,
                  detail: `${tag.count} transaction${tag.count === 1 ? "" : "s"}`,
                }))
              }
              add={async (name) => {
                await api.tags.create(name);
              }}
              remove={async (item) => {
                await api.tags.remove(item.label);
              }}
              addLabel="Add tag"
              addPlaceholder="New tag name"
              emptyTitle="No tags yet"
              emptyDescription="Add a tag by name to attach it to transactions."
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="recovery">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
                Recovery
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <IgnoredSuggestionsSection />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="delete">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                Delete account
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <DeleteAccountSection />
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
