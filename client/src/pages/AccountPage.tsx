import { useState } from "react";
import {
  Building2,
  CreditCard,
  Landmark,
  Plus,
  Trash2,
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
import type { Account, AccountType } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

const TYPE_CONFIG: Record<
  AccountType,
  { icon: typeof Wallet; color: string; label: string }
> = {
  cash: {
    icon: Wallet,
    color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20",
    label: "Cash",
  },
  credit: {
    icon: CreditCard,
    color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/20",
    label: "Credit",
  },
  investment: {
    icon: Building2,
    color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20",
    label: "Investment",
  },
};

export default function AccountPage() {
  const accounts = useQuery<Account[]>(() => api.accounts.list(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash" as AccountType });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await api.accounts.create(name, form.type);
      setForm({ name: "", type: "cash" });
      setOpen(false);
      accounts.refetch();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: Account) {
    if (
      !window.confirm(
        `Delete "${account.name}"? Existing transactions keep the label.`
      )
    ) {
      return;
    }
    setDeletingId(account.id);
    try {
      await api.accounts.remove(account.id);
      accounts.refetch();
    } catch (err) {
      window.alert(message(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage your cash, credit, and investment accounts.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Add account
        </Button>
      </div>

      {accounts.status === "loading" && <LoadingState label="Loading accounts…" />}
      {accounts.status === "error" && (
        <ErrorState
          message={accounts.error?.message ?? "Failed to load accounts."}
          onRetry={accounts.refetch}
        />
      )}
      {accounts.status === "success" &&
        (accounts.data ?? []).length === 0 && (
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

      {accounts.status === "success" && (accounts.data ?? []).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts.data ?? []).map((account) => {
            const config =
              TYPE_CONFIG[account.type] ?? TYPE_CONFIG.cash;
            const Icon = config.icon;
            return (
              <div
                key={account.id}
                className="flex items-start justify-between rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      config.color
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="text-xs capitalize text-muted-foreground">
                      {config.label}
                    </p>
                  </div>
                </div>
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
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <SheetHeader>
              <SheetTitle>Add account</SheetTitle>
              <SheetDescription>
                Create a new cash, credit, or investment account.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Account name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
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
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type }))}
                        aria-pressed={form.type === type}
                        className={cn(
                          "flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                          form.type === type
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <TypeIcon className="size-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <SheetFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create account"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
