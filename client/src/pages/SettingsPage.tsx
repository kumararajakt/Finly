import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  FolderOpen,
  Landmark,
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
import type { Account, AccountType, Category, Density, Tag } from "@/lib/types";
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
  remove: (item: ManagedItem) => Promise<void>;
  rename?: (item: ManagedItem, name: string) => Promise<void>;
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

  async function handleRemove(item: ManagedItem) {
    if (
      !window.confirm(
        `Delete "${item.label}"? It will be removed from future selectors. Categories in use by transactions cannot be deleted.`
      )
    ) {
      return;
    }
    setBusyKey(item.key);
    setError(null);
    try {
      await remove(item);
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyKey(null);
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

const ACCOUNT_TYPE_CONFIG: Record<AccountType, { icon: ComponentType<{ className?: string }>; color: string; label: string }> = {
  cash: { icon: Wallet, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20", label: "Cash" },
  credit: { icon: CreditCard, color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/20", label: "Credit" },
  investment: { icon: Building2, color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20", label: "Investment" },
};

function AccountsSection() {
  const query = useQuery<Account[]>(() => api.accounts.list(), []);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<AccountType>("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("cash");
  const [editBusy, setEditBusy] = useState(false);

  async function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await api.accounts.create(name, draftType);
      setDraft("");
      setDraftType("cash");
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(account: Account) {
    if (
      !window.confirm(
        `Delete "${account.name}"? It will be removed from future selectors.`
      )
    ) {
      return;
    }
    setBusyKey(account.id);
    setError(null);
    try {
      await api.accounts.remove(account.id);
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyKey(null);
    }
  }

  function startEdit(account: Account) {
    setEditing(account.id);
    setEditName(account.name);
    setEditType(account.type);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditName("");
    setEditType("cash");
  }

  async function handleUpdate(account: Account) {
    const name = editName.trim();
    if (!name) return;
    setEditBusy(true);
    setError(null);
    try {
      await api.accounts.update(account.id, { name, type: editType });
      setEditing(null);
      setEditName("");
      query.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center gap-1.5">
        <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">Accounts</span>
        {query.status === "success" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {(query.data ?? []).length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="New account name"
          className="w-40 sm:w-48"
          aria-label="Account name"
        />
        <div className="flex gap-1" role="group" aria-label="Account type">
          {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((t) => {
            const cfg = ACCOUNT_TYPE_CONFIG[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setDraftType(t)}
                className={cn(
                  "h-8 rounded-md px-2 text-xs font-medium transition-colors",
                  draftType === t
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!draft.trim() || saving}
        >
          {saving ? "Adding…" : "Add"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {query.status === "loading" && <LoadingState label="Loading accounts…" />}
      {query.status === "error" && (
        <ErrorState
          message={query.error?.message ?? "Failed to load accounts."}
          onRetry={query.refetch}
        />
      )}
      {query.status === "success" &&
        ((query.data ?? []).length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No accounts yet"
            description="Accounts label where money lives. Existing transactions keep the label after deletion."
          />
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((account) => {
              const cfg = ACCOUNT_TYPE_CONFIG[account.type] ?? ACCOUNT_TYPE_CONFIG.cash;
              const Icon = cfg.icon;
              return (
                <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                  {editing === account.id ? (
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleUpdate(account);
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          placeholder="Account name"
                          className="h-8 w-full"
                          aria-label="Account name"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => void handleUpdate(account)}
                          disabled={!editName.trim() || editBusy}
                          aria-label="Save changes"
                        >
                          <Check />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={editBusy}
                          aria-label="Cancel edit"
                        >
                          <X />
                        </Button>
                      </div>
                      <div className="flex gap-1" role="group" aria-label="Account type">
                        {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((t) => {
                          const tCfg = ACCOUNT_TYPE_CONFIG[t];
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setEditType(t)}
                              className={cn(
                                "h-8 rounded-md px-2 text-xs font-medium transition-colors",
                                editType === t
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {tCfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", cfg.color)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 truncate text-sm">{account.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground">{cfg.label}</span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startEdit(account)}
                          disabled={busyKey === account.id}
                          aria-label={`Edit ${account.name}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleRemove(account)}
                          disabled={busyKey === account.id}
                          aria-label={`Delete ${account.name}`}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your net worth, categories, tags, and accounts.
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
              remove={async (item) => {
                await api.categories.remove(item.key);
              }}
              rename={async (item, name) => {
                await api.categories.rename(item.key, name);
              }}
              addLabel="Add"
              addPlaceholder="New category name"
              emptyTitle="No categories yet"
              emptyDescription="Categories drive the pickers used across the app."
            />
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="accounts">
          <AccordionHeader>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
                Accounts
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <AccountsSection />
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
