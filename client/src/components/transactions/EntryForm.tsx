import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";
import type { Account, Category, Tag, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import TagPicker from "./TagPicker";
import { ensureTags, message } from "./shared";

interface EntryForm {
  type: TransactionType;
  amount: string;
  merchant: string;
  date: string;
  category: string;
  account: string;
  tags: string[];
  notes: string;
}

function initialForm(initial: Transaction | null): EntryForm {
  return {
    type: initial?.type ?? "expense",
    amount: initial ? String(initial.amount) : "",
    merchant: initial?.merchant ?? "",
    date: initial?.date ?? todayISO(),
    category: initial?.category ?? "",
    account: initial?.account ?? "",
    tags: initial?.tags ?? [],
    notes: initial?.notes ?? "",
  };
}

interface EntryFormProps {
  categories: Category[];
  accounts: Account[];
  tags: Tag[];
  initial?: Transaction | null;
  onSaved: () => void;
}

export default function EntryForm({ categories, accounts, tags, initial, onSaved }: EntryFormProps) {
  const [form, setForm] = useState<EntryForm>(() => initialForm(initial ?? null));
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
      const notes = form.notes.trim();
      if (initial) {
        await api.transactions.update(initial.id, {
          date: form.date,
          merchant: form.merchant.trim(),
          category: form.category,
          account: form.account,
          amount,
          type: form.type,
          tags: form.tags,
          notes,
        });
      } else {
        await api.transactions.create({
          date: form.date,
          merchant: form.merchant.trim(),
          category: form.category,
          account: form.account,
          amount,
          type: form.type,
          tags: form.tags,
          notes,
        });
      }
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
        <SheetTitle>{initial ? "Edit entry" : "Add entry"}</SheetTitle>
        <SheetDescription>
          {initial ? initial.merchant : "Record an expense or income transaction."}
        </SheetDescription>
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes about this transaction"
            maxLength={2000}
            rows={3}
            className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
          {saving ? "Saving…" : initial ? "Save changes" : "Save entry"}
        </Button>
      </SheetFooter>
    </form>
  );
}
