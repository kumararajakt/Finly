import { Suspense, lazy, useEffect, useState } from "react";
import { ChevronsUpDown, Paperclip, Pencil, Plus, Receipt, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import PeriodSelector from "@/components/PeriodSelector";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/ui/loading-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { message } from "@/components/transactions/shared";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { formatDate, formatSignedAmount } from "@/lib/format";
import type { Account, Category, Tag, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const CsvImportCard = lazy(() => import("@/components/CsvImportCard"));
const EntryForm = lazy(() => import("@/components/transactions/EntryForm"));
const TagEditorSheet = lazy(() => import("@/components/transactions/TagEditorSheet"));

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

export default function TransactionPage() {
  const { settings } = useSettings();
  const period = settings.selectedPeriod;
  const currency = settings.currency;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"expense" | "income" | "transfer" | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [receiptFilter, setReceiptFilter] = useState<"all" | "yes" | "no">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editorTx, setEditorTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const transactions = useQuery<Transaction[]>(
    () =>
      api.transactions.list({
        period,
        ...(accountFilter !== "all" ? { account: accountFilter } : {}),
        ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(typeFilter !== "all" ? { type: typeFilter } : {}),
        ...(tagFilter !== "all" ? { tag: tagFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(minAmount !== "" ? { minAmount: Number(minAmount) } : {}),
        ...(maxAmount !== "" ? { maxAmount: Number(maxAmount) } : {}),
        ...(receiptFilter !== "all" ? { receipt: receiptFilter === "yes" } : {}),
      }),
    [period, settings.customDateFrom, settings.customDateTo, accountFilter, categoryFilter, debouncedSearch, typeFilter, tagFilter, dateFrom, dateTo, minAmount, maxAmount, receiptFilter]
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
    setTypeFilter("all");
    setTagFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    setReceiptFilter("all");
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

  async function handleDeleteTransaction(tx: Transaction) {
    if (!window.confirm(`Delete the transaction "${tx.merchant}"? This cannot be undone.`)) return;
    setDeletingId(tx.id);
    setMutationError(null);
    try {
      await api.transactions.remove(tx.id);
      transactions.setData((list) =>
        (list ?? []).filter((item) => item.id !== tx.id)
      );
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setDeletingId(null);
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
    setEditTx(null);
  }

  const hasActiveFilters =
    debouncedSearch !== "" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    tagFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    minAmount !== "" ||
    maxAmount !== "" ||
    receiptFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-sm text-muted-foreground">Review and manage your transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            <span>Import</span>
          </Button>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMoreFilters((value) => !value)}
          aria-expanded={showMoreFilters}
          className={cn(showMoreFilters && "border-ring bg-muted/50")}
        >
          <SlidersHorizontal />
          <span>More filters</span>
        </Button>
      </div>

      {showMoreFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "expense" | "income" | "transfer" | "all")}
            aria-label="Type filter"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
            <option value="transfer">Transfers</option>
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Tag filter"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All tags</option>
            {(tags.data ?? []).map((tag) => (
              <option key={tag.name} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
          <select
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value as "all" | "yes" | "no")}
            aria-label="Receipt filter"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">With or without receipts</option>
            <option value="yes">With receipts</option>
            <option value="no">Without receipts</option>
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            className="h-8 w-auto"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            className="h-8 w-auto"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="Min amount"
            aria-label="Minimum amount"
            className="h-8 w-32"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="Max amount"
            aria-label="Maximum amount"
            className="h-8 w-32"
          />
        </div>
      )}

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
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                      <Upload />
                      Import
                    </Button>
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      <Plus />
                      Add entry
                    </Button>
                  </div>
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
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
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
                      <TableCell className="hidden max-w-56 md:table-cell">
                        {tx.notes ? (
                          <p className="truncate text-sm text-muted-foreground" title={tx.notes}>
                            {tx.notes}
                          </p>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
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
                            tx.type === "income"
                              ? "text-emerald-600"
                              : tx.type === "transfer"
                                ? "text-muted-foreground"
                                : "text-foreground"
                          )}
                        >
                          {formatSignedAmount(tx.amount, tx.type, currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditTx(tx)}
                            aria-label={`Edit ${tx.merchant}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDeleteTransaction(tx)}
                            disabled={deletingId === tx.id}
                            aria-label={`Delete ${tx.merchant}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
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
        <Suspense fallback={null}>
          <TagEditorSheet
            transaction={editorTx}
            tags={tags.data ?? []}
            onClose={() => setEditorTx(null)}
            onSaved={handleTagsSaved}
          />
        </Suspense>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <Suspense fallback={<LoadingState className="border-0" label="Loading form…" />}>
            <EntryForm
              categories={categories.data ?? []}
              accounts={accounts.data ?? []}
              tags={tags.data ?? []}
              onSaved={handleEntrySaved}
            />
          </Suspense>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <SheetContent side="right" className="sm:max-w-md">
          <Suspense fallback={<LoadingState className="border-0" label="Loading form…" />}>
            {editTx && (
              <EntryForm
                initial={editTx}
                categories={categories.data ?? []}
                accounts={accounts.data ?? []}
                tags={tags.data ?? []}
                onSaved={handleEntrySaved}
              />
            )}
          </Suspense>
        </SheetContent>
      </Sheet>

      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <Suspense fallback={<LoadingState className="py-8" label="Loading importer…" />}>
              <CsvImportCard
                onNavigate={() => setImportOpen(false)}
                onImported={() => transactions.refetch()}
              />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
