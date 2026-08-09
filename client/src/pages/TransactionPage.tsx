import { useEffect, useState } from "react";
import { ChevronsUpDown, Paperclip, Plus, Receipt, Search, X } from "lucide-react";
import PeriodSelector from "@/components/PeriodSelector";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatSignedAmount, todayISO } from "@/lib/format";
import type { Account, Category, Tag, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

async function ensureTags(names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await api.tags.create(name);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "DUPLICATE_TAG")) throw error;
    }
  }
}

interface TagPickerProps {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function TagPicker({ available, selected, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState("");

  function addNew() {
    const name = draft.trim();
    if (!name) return;
    if (!selected.includes(name)) onChange([...selected, name]);
    setDraft("");
  }

  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((value) => value !== name) : [...selected, name]
    );
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-foreground transition-colors hover:border-input"
            >
              {tag}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Existing tags</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {available
              .filter((tag) => !selected.includes(tag))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  {tag}
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNew();
            }
          }}
          placeholder="Add a new tag by name"
        />
        <Button type="button" variant="outline" onClick={addNew} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

interface CategoryCellProps {
  value: string;
  names: string[];
  disabled?: boolean;
  onChange: (name: string) => void;
}

function CategoryCell({ value, names, disabled, onChange }: CategoryCellProps) {
  const options = names.includes(value) ? names : [value, ...names];
  return (
    <div className="group/cat inline-flex items-center gap-0.5">
      <select
        value={value}
        disabled={disabled || names.length === 0}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Category"
        className="h-7 max-w-44 cursor-pointer appearance-none rounded-md border border-transparent bg-transparent py-0 pl-1 pr-0.5 text-sm outline-none transition-colors hover:border-input hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
      >
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="size-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/cat:opacity-100"
        aria-hidden="true"
      />
    </div>
  );
}

interface TagPillsProps {
  tags: string[];
  removing: string | null;
  onRemove: (tag: string) => void;
  onAdd: () => void;
}

function TagPills({ tags, removing, onRemove, onAdd }: TagPillsProps) {
  return (
    <ul className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <li key={tag}>
          <button
            type="button"
            onClick={() => onRemove(tag)}
            disabled={removing === tag}
            title={`Remove tag ${tag}`}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground disabled:cursor-default disabled:opacity-50"
          >
            {tag}
            <X className="size-3" aria-hidden="true" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add tag"
          title="Add tag"
          className="inline-flex size-5 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3" aria-hidden="true" />
        </button>
      </li>
    </ul>
  );
}

interface TagEditorSheetProps {
  transaction: Transaction;
  tags: Tag[];
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}

function TagEditorSheet({ transaction, tags, onClose, onSaved }: TagEditorSheetProps) {
  const [selected, setSelected] = useState<string[]>(transaction.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(transaction.tags);
  }, [transaction]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await ensureTags(selected);
      const updated = await api.transactions.update(transaction.id, { tags: selected });
      setSaving(false);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit tags</SheetTitle>
          <SheetDescription>{transaction.merchant}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <TagPicker
            available={tags.map((tag) => tag.name)}
            selected={selected}
            onChange={setSelected}
          />
          {error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save tags"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface EntryForm {
  type: TransactionType;
  amount: string;
  merchant: string;
  date: string;
  category: string;
  account: string;
  tags: string[];
}

function blankForm(): EntryForm {
  return {
    type: "expense",
    amount: "",
    merchant: "",
    date: todayISO(),
    category: "",
    account: "",
    tags: [],
  };
}

interface AddEntryFormProps {
  categories: Category[];
  accounts: Account[];
  tags: Tag[];
  onSaved: () => void;
}

function AddEntryForm({ categories, accounts, tags, onSaved }: AddEntryFormProps) {
  const [form, setForm] = useState<EntryForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm((f) => ({ ...f, category: categories[0].name }));
    }
  }, [categories, form.category]);

  useEffect(() => {
    if (!form.account && accounts.length > 0) {
      setForm((f) => ({ ...f, account: accounts[0].name }));
    }
  }, [accounts, form.account]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number.parseFloat(form.amount);
    if (!form.date) return setError("Please choose a date.");
    if (!form.merchant.trim()) return setError("Please enter a merchant or source.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Please enter a positive amount.");
    if (!form.category) return setError("Please choose a category.");
    if (!form.account) return setError("Please choose an account.");

    setSaving(true);
    setError(null);
    try {
      await ensureTags(form.tags);
      await api.transactions.create({
        date: form.date,
        merchant: form.merchant.trim(),
        category: form.category,
        account: form.account,
        amount,
        type: form.type,
        tags: form.tags,
      });
      setForm(blankForm());
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  const knownCategory = form.category && !categories.some((c) => c.name === form.category);
  const knownAccount = form.account && !accounts.some((a) => a.name === form.account);

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>Add entry</SheetTitle>
        <SheetDescription>Record an expense or income transaction.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1" role="group" aria-label="Transaction type">
          {(["expense", "income"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type }))}
              aria-pressed={form.type === type}
              className={cn(
                "h-7 rounded-md text-sm font-medium transition-colors",
                form.type === type
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {type === "expense" ? "Expense" : "Income"}
            </button>
          ))}
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
            <label className="text-xs font-medium">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Merchant / source</label>
          <Input
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
            placeholder="e.g. Grocery Store"
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
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {accounts.length === 0 && (
                <option value="" disabled>
                  No accounts yet
                </option>
              )}
              {knownAccount && <option value={form.account}>{form.account}</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.name}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Tags</label>
          <TagPicker
            available={tags.map((tag) => tag.name)}
            selected={form.tags}
            onChange={(next) => setForm((f) => ({ ...f, tags: next }))}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save entry"}
        </Button>
      </SheetFooter>
    </form>
  );
}

interface TransactionPageProps {
  addEntrySignal?: number;
}

export default function TransactionPage({ addEntrySignal }: TransactionPageProps) {
  const { settings } = useSettings();
  const period = settings.selectedPeriod;
  const currency = settings.currency;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editorTx, setEditorTx] = useState<Transaction | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (addEntrySignal && addEntrySignal > 0) {
      setAddOpen(true);
    }
  }, [addEntrySignal]);

  const transactions = useQuery<Transaction[]>(
    () =>
      api.transactions.list({
        period,
        ...(accountFilter !== "all" ? { account: accountFilter } : {}),
        ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    [period, accountFilter, categoryFilter, debouncedSearch]
  );
  const categories = useQuery<Category[]>(() => api.categories.list(), []);
  const accounts = useQuery<Account[]>(() => api.accounts.list(), []);
  const tags = useQuery<Tag[]>(() => api.tags.list(), []);

  const categoryNames = (categories.data ?? []).map((category) => category.name);
  const accountNames = (accounts.data ?? []).map((account) => account.name);

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setAccountFilter("all");
    setCategoryFilter("all");
  }

  async function handleCategoryChange(tx: Transaction, name: string) {
    if (name === tx.category) return;
    setSavingCategory(tx.id);
    setMutationError(null);
    try {
      const updated = await api.transactions.update(tx.id, { category: name });
      transactions.setData((list) =>
        (list ?? [])
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
      );
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingCategory(null);
    }
  }

  async function handleRemoveTag(tx: Transaction, tag: string) {
    setRemovingTag(`${tx.id}:${tag}`);
    setMutationError(null);
    try {
      const updated = await api.transactions.update(tx.id, {
        tags: tx.tags.filter((value) => value !== tag),
      });
      transactions.setData((list) =>
        (list ?? []).map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setRemovingTag(null);
    }
  }

  function handleTagsSaved(updated: Transaction) {
    transactions.setData((list) =>
      (list ?? []).map((item) => (item.id === updated.id ? updated : item))
    );
    tags.refetch();
  }

  function handleEntrySaved() {
    transactions.refetch();
    tags.refetch();
    setAddOpen(false);
  }

  const hasActiveFilters = debouncedSearch !== "" || accountFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-sm text-muted-foreground">Review and manage your transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector />
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            Add entry
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by merchant, category, or tag"
            className="pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          aria-label="Account filter"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="all">All accounts</option>
          {accountNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Category filter"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="all">All categories</option>
          {categoryNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {transactions.status === "loading" && <LoadingState label="Loading transactions…" />}
      {transactions.status === "error" && (
        <ErrorState
          message={transactions.error?.message ?? "Failed to load transactions."}
          onRetry={transactions.refetch}
        />
      )}
      {transactions.status === "success" && transactions.data && (
        <>
          {transactions.data.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                title="No matching transactions"
                description="No transactions match the current filters."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Add your first entry or import a statement to get started."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus />
                    Add entry
                  </Button>
                }
              />
            )
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Account</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.data.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{tx.merchant}</span>
                          {tx.receipt && (
                            <span title="Has receipt attached">
                              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                      </TableCell>
                      <TableCell>
                        <CategoryCell
                          value={tx.category}
                          names={categoryNames}
                          disabled={savingCategory === tx.id}
                          onChange={(name) => handleCategoryChange(tx, name)}
                        />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {tx.account}
                      </TableCell>
                      <TableCell>
                        <TagPills
                          tags={tx.tags}
                          removing={removingTag}
                          onRemove={(tag) => handleRemoveTag(tx, tag)}
                          onAdd={() => setEditorTx(tx)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            tx.type === "income" ? "text-emerald-600" : "text-foreground"
                          )}
                        >
                          {formatSignedAmount(tx.amount, tx.type, currency)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {editorTx && (
        <TagEditorSheet
          transaction={editorTx}
          tags={tags.data ?? []}
          onClose={() => setEditorTx(null)}
          onSaved={handleTagsSaved}
        />
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <AddEntryForm
            categories={categories.data ?? []}
            accounts={accounts.data ?? []}
            tags={tags.data ?? []}
            onSaved={handleEntrySaved}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
