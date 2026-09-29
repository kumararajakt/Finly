import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Check, FolderOpen, Pencil, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
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
import {
  resolveSettingsSection,
  settingsSections,
  type SettingsSectionValue,
} from "@/utils/settings-menu";

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
  const [pendingDelete, setPendingDelete] = useState<ManagedItem | null>(null);

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

  function handleRemove(item: ManagedItem) {
    if (requestRemove) {
      requestRemove(item, (moveTo) => performRemove(item, moveTo));
      return;
    }
    setPendingDelete(item);
  }

  /** Deletes and rethrows, so ConfirmDialog can show the failure inline. */
  async function confirmRemove(item: ManagedItem) {
    const failure = await performRemove(item);
    if (failure) throw new Error(failure);
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
      {/* The section name is the page heading now, so this row only carries the count. */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {query.status === "success" && <span>{(query.data ?? []).length} in use</span>}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.label}"?`}
        description="It will be removed from future selectors."
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          return confirmRemove(pendingDelete);
        }}
      />
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
 * created on the server when it doesn't already exist. A single dialog covers
 * both cases — the move field only appears when something is still referenced.
 */
function CategoriesSection() {
  const [items, setItems] = useState<ManagedItem[]>([]);
  const [pending, setPending] = useState<ManagedItem | null>(null);
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<((moveTo?: string) => Promise<string | null>) | null>(null);

  const handleLoaded = useCallback((loaded: ManagedItem[]) => setItems(loaded), []);

  function closeDialog() {
    setPending(null);
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
      confirmRef.current = confirm;
      setPending(item);
      setUsage(found);
      setMoveTo("");
    } catch (err) {
      setError(message(err));
    } finally {
      setChecking(false);
    }
  }

  const needsMove = usage !== null && usageCount(usage) > 0;
  const trimmed = moveTo.trim();
  const sameAsPending =
    pending !== null &&
    needsMove &&
    trimmed.toLowerCase() === pending.label.toLowerCase();
  const canSubmit =
    pending !== null &&
    !submitting &&
    !checking &&
    (!needsMove || (trimmed !== "" && !sameAsPending));

  async function handleConfirm() {
    const confirm = confirmRef.current;
    if (!confirm || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const failure = await confirm(needsMove ? trimmed : undefined);
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
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{pending?.label}&quot;?</DialogTitle>
            <DialogDescription>
              {needsMove && usage
                ? `${usageSummary(usage)} still use this category. Choose where they should move to — it is created if it does not exist yet — and the category is deleted.`
                : "Nothing uses this category yet. It will be removed from future selectors."}
            </DialogDescription>
          </DialogHeader>

          {needsMove && (
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
                    void handleConfirm();
                  }
                }}
                placeholder="e.g. Other"
                aria-invalid={sameAsPending}
                autoFocus
              />
              <datalist id="category-move-to-options">
                {items
                  .filter((item) => item.key !== pending?.key)
                  .map((item) => (
                    <option key={item.key} value={item.label} />
                  ))}
              </datalist>
              {sameAsPending && (
                <p role="alert" className="text-xs text-destructive">
                  Pick a different category than the one being deleted.
                </p>
              )}
            </div>
          )}

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
              onClick={() => void handleConfirm()}
              disabled={!canSubmit}
            >
              {submitting ? "Deleting…" : needsMove ? "Move and delete" : "Delete"}
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

      <div className="flex max-w-xl flex-wrap items-center justify-between gap-3">
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
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [saved, setSaved] = useState(false);

  const count = settings.dismissedPatterns.length;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function handleRestore() {
    await saveSetting("dismissedPatterns", []);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <p className="max-w-xl text-sm text-muted-foreground">
        Patterns you've ignored on the Recurring and Subscriptions pages stay hidden until you
        restore them.
      </p>
      <div className="flex max-w-xl flex-wrap items-center justify-between gap-3">
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingRestore(true)}
            disabled={count === 0}
          >
            Restore ignored suggestions
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRestore}
        title="Restore ignored suggestions?"
        description="Previously ignored patterns will be suggested again on the Recurring and Subscriptions pages."
        confirmLabel="Restore"
        pendingLabel="Restoring…"
        tone="default"
        onOpenChange={setConfirmingRestore}
        onConfirm={handleRestore}
      />
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

/** Tags are a plain name list, so the shared `ManagedList` covers the whole section. */
function TagsSection() {
  return (
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
  );
}

/**
 * The settings sections are navigated from the settings sidebar (see
 * `Sidebar.tsx`), which puts the active one in the `section` search param. Only
 * that one is rendered — the accordion that used to hold them is gone.
 */
export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const active = resolveSettingsSection(searchParams.get("section"));
  const section = settingsSections.find((item) => item.value === active) ?? settingsSections[0];

  const panels: Record<SettingsSectionValue, ReactNode> = {
    "net-worth": <NetWorthSection />,
    density: <DensitySection />,
    categories: <CategoriesSection />,
    tags: <TagsSection />,
    recovery: <IgnoredSuggestionsSection />,
    delete: <DeleteAccountSection />,
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h2
        className={cn("text-lg font-semibold", section.destructive && "text-destructive")}
      >
        {section.label}
      </h2>

      {panels[active]}
    </div>
  );
}
