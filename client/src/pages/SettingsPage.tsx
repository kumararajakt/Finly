import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Check,
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
import type { Account, Category, Density, Tag } from "@/lib/types";
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
        `Delete "${item.label}"? It will be removed from future selectors. Existing transactions keep the label.`
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
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-medium">{title}</h3>
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
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
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
    </section>
  );
}

function NetWorthSection() {
  const { settings, status, error, refetch, saveSetting } = useSettings();
  const [assetsInput, setAssetsInput] = useState("");
  const [liabilitiesInput, setLiabilitiesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "success") {
      setAssetsInput(settings.totalAssets ? String(settings.totalAssets) : "");
      setLiabilitiesInput(settings.totalLiabilities ? String(settings.totalLiabilities) : "");
    }
  }, [status, settings.totalAssets, settings.totalLiabilities]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const assets = toAmount(assetsInput);
  const liabilities = toAmount(liabilitiesInput);
  const preview =
    assets !== null && liabilities !== null
      ? formatCurrency(assets - liabilities, settings.currency)
      : null;

  async function handleSave() {
    const assetsValue = toAmount(assetsInput);
    const liabilitiesValue = toAmount(liabilitiesInput);
    if (assetsValue === null || liabilitiesValue === null) {
      setSaveError("Enter valid numbers for assets and liabilities.");
      return;
    }
    if (assetsValue < 0 || liabilitiesValue < 0) {
      setSaveError("Assets and liabilities can't be negative.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveSetting("totalAssets", assetsValue);
      await saveSetting("totalLiabilities", liabilitiesValue);
      await saveSetting("netWorthConfigured", true);
      setSaved(true);
    } catch (err) {
      setSaveError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">Net worth</h3>
        {settings.netWorthConfigured && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Set
          </span>
        )}
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Net worth is the total of your assets minus your liabilities. It isn't calculated from
        income and expenses — update it here whenever you want it to change.
      </p>

      {status === "loading" ? (
        <LoadingState label="Loading settings…" />
      ) : status === "error" ? (
        <ErrorState
          message={error?.message ?? "Failed to load settings."}
          onRetry={refetch}
        />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor="total-assets">
              Total assets
            </label>
            <Input
              id="total-assets"
              type="text"
              inputMode="decimal"
              value={assetsInput}
              onChange={(e) => setAssetsInput(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor="total-liabilities">
              Total liabilities
            </label>
            <Input
              id="total-liabilities"
              type="text"
              inputMode="decimal"
              value={liabilitiesInput}
              onChange={(e) => setLiabilitiesInput(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Assets <span aria-hidden="true">−</span> Liabilities ={" "}
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
            {saving ? "Saving…" : settings.netWorthConfigured ? "Update net worth" : "Save net worth"}
          </Button>
        </div>
      </div>
    </section>
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
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">Layout density</h3>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
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
          className="mt-4 flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1"
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
                "h-7 rounded-md px-2.5 text-sm font-medium transition-colors disabled:opacity-50",
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
        <p role="alert" className="mt-3 text-xs text-destructive">
          {saveError}
        </p>
      )}
    </section>
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
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">Recovery</h3>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Patterns you've ignored on the Recurring and Subscriptions pages stay hidden until you
        restore them.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
    </section>
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
    <section className="rounded-xl border border-destructive/30 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
          <h3 className="text-sm font-medium">Delete account</h3>
        </div>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 />
          Delete account
        </Button>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Permanently deletes your account and every transaction, budget, goal, recurring
        payment, and setting. This cannot be undone.
      </p>

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
    </section>
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

      <NetWorthSection />

      <DensitySection />

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

      <ManagedList
        icon={Landmark}
        title="Accounts"
        list={async (): Promise<ManagedItem[]> =>
          (await api.accounts.list()).map((account: Account) => ({
            key: account.id,
            label: account.name,
          }))
        }
        add={async (name) => {
          await api.accounts.create(name);
        }}
        remove={async (item) => {
          await api.accounts.remove(item.key);
        }}
        addLabel="Add"
        addPlaceholder="New account name"
        emptyTitle="No accounts yet"
        emptyDescription="Accounts label where money lives. Existing transactions keep the label after deletion."
      />

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

      <IgnoredSuggestionsSection />

      <DeleteAccountSection />
    </div>
  );
}
