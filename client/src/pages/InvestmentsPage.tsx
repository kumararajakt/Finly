import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2, Wallet, Upload } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TradeImportModal } from "@/components/trade-import-modal";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Account,
  CreateTrade,
  Position,
  Trade,
  TradeSide,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface TradeFormProps {
  accounts: Account[];
  onSaved: () => void;
  onCancel: () => void;
}

function TradeForm({ accounts, onSaved, onCancel }: TradeFormProps) {
  const investmentAccounts = accounts.filter((a) => a.type === "investment");

  const [side, setSide] = useState<TradeSide>("buy");
  const [form, setForm] = useState({
    accountId: investmentAccounts[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    security: "",
    units: "",
    price: "",
    fee: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const amount =
    Number.isFinite(Number(form.units)) && Number.isFinite(Number(form.price))
      ? Number(form.units) * Number(form.price)
      : 0;

  async function handleFetchQuote() {
    if (!form.security.trim()) return;
    setQuoteLoading(true);
    setError(null);
    try {
      const result = await api.investments.getQuote(form.security.trim());
      setForm((f) => ({ ...f, price: String(result.price) }));
    } catch (err) {
      setError(message(err));
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const units = Number(form.units);
    const price = Number(form.price);
    if (!form.security.trim()) return setError("Security name is required.");
    if (!Number.isFinite(units) || units <= 0) return setError("Units must be positive.");
    if (!Number.isFinite(price) || price <= 0) return setError("Price must be positive.");
    if (!form.accountId) return setError("Select an investment account.");

    setSaving(true);
    setError(null);
    try {
      const data: CreateTrade = {
        accountId: form.accountId,
        date: form.date,
        security: form.security.trim(),
        side,
        units,
        price,
        ...(form.fee ? { fee: Number(form.fee) } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      await api.investments.createTrade(data);
      onSaved();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>New trade</SheetTitle>
        <SheetDescription>Record a buy, sell, or dividend.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div
          className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1"
          role="group"
          aria-label="Trade side"
        >
          {(["buy", "sell", "dividend"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={cn(
                "h-7 rounded-md text-sm font-medium capitalize transition-colors",
                side === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Security / fund name</label>
          <div className="flex gap-1.5">
            <Input
              value={form.security}
              onChange={(e) =>
                setForm((f) => ({ ...f, security: e.target.value }))
              }
              placeholder="e.g. RELIANCE.NS or HDFC Small Cap"
              required
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleFetchQuote}
              disabled={quoteLoading || !form.security.trim()}
              className="shrink-0"
            >
              {quoteLoading ? "Fetching…" : "Quote"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Units / quantity</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0.0001"
              value={form.units}
              onChange={(e) =>
                setForm((f) => ({ ...f, units: e.target.value }))
              }
              placeholder="0.0000"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Price per unit</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0.0001"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
              placeholder="0.0000"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Fee (optional)</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.fee}
              onChange={(e) =>
                setForm((f) => ({ ...f, fee: e.target.value }))
              }
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Investment account</label>
          <select
            value={form.accountId}
            onChange={(e) =>
              setForm((f) => ({ ...f, accountId: e.target.value }))
            }
            required
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {investmentAccounts.length === 0 && (
              <option value="" disabled>
                No investment accounts
              </option>
            )}
            {investmentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {amount > 0 && (
          <p className="text-sm text-muted-foreground">
            Amount:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(amount)}
            </span>
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            placeholder="Optional notes"
            maxLength={2000}
            rows={2}
            className="min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Record trade"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function PositionRow({
  position,
  currency,
}: {
  position: Position;
  currency: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{position.security}</TableCell>
      <TableCell className="tabular-nums">{position.units}</TableCell>
      <TableCell className="tabular-nums">
        {formatCurrency(position.avgCost, currency)}
      </TableCell>
      <TableCell className="tabular-nums">
        {position.currentPrice !== null
          ? formatCurrency(position.currentPrice, currency)
          : "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {position.marketValue !== null
          ? formatCurrency(position.marketValue, currency)
          : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "tabular-nums",
          position.unrealizedPL !== null
            ? position.unrealizedPL >= 0
              ? "text-emerald-600"
              : "text-red-600"
            : "text-muted-foreground"
        )}
      >
        {position.unrealizedPL !== null
          ? formatCurrency(position.unrealizedPL, currency)
          : "—"}
      </TableCell>
    </TableRow>
  );
}

function TradeRow({
  trade,
  currency,
  onDelete,
}: {
  trade: Trade;
  currency: string;
  onDelete: (trade: Trade) => void;
}) {
  const sideLabel =
    trade.side === "buy"
      ? "Buy"
      : trade.side === "sell"
        ? "Sell"
        : trade.side === "dividend"
          ? "Div"
          : "Int";
  return (
    <TableRow>
      <TableCell>{formatDate(trade.date)}</TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            trade.side === "buy"
              ? "bg-blue-500/10 text-blue-600"
              : trade.side === "sell"
                ? "bg-orange-500/10 text-orange-600"
                : "bg-emerald-500/10 text-emerald-600"
          )}
        >
          {sideLabel}
        </span>
      </TableCell>
      <TableCell className="font-medium">{trade.security}</TableCell>
      <TableCell className="tabular-nums">{trade.units}</TableCell>
      <TableCell className="tabular-nums">
        {formatCurrency(trade.price, currency)}
      </TableCell>
      <TableCell className="tabular-nums">
        {formatCurrency(trade.amount, currency)}
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {trade.fee > 0 ? formatCurrency(trade.fee, currency) : "—"}
      </TableCell>
      <TableCell className="w-8 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${trade.side} of ${trade.security}`}
          onClick={() => onDelete(trade)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MiniLedger({
  trades,
  security,
  currency,
  onDelete,
}: {
  trades: Trade[];
  security: string;
  currency: string;
  onDelete: (trade: Trade) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">{security}</h3>
      <div className="mt-2">
        {trades.length === 0 ? (
          <EmptyState description="No trades for this security." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    currency={currency}
                    onDelete={onDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvestmentsPage() {
  const { settings } = useSettings();
  const currency = settings.currency;

  const [tradeOpen, setTradeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const accounts = useQuery<Account[]>(() => api.accounts.list(), []);
  const positions = useQuery<Position[]>(
    () =>
      api.investments.getPositions(
        selectedAccount !== "all" ? { accountId: selectedAccount } : undefined,
      ),
    [selectedAccount],
  );
  const summary = useQuery(
    () =>
      api.investments.getSummary(
        selectedAccount !== "all" ? selectedAccount : undefined,
      ),
    [selectedAccount],
  );
  const trades = useQuery<Trade[]>(
    () =>
      api.investments.listTrades(
        selectedAccount !== "all" ? { accountId: selectedAccount } : undefined,
      ),
    [selectedAccount],
  );

  const staleDataKey = useRef<string | null>(null);

  useEffect(() => {
    if (positions.status === "success") {
      const hasStalePrices = positions.data.some((p) => p.currentPrice === null);
      if (hasStalePrices && positions.data.length > 0) {
        const key = positions.data.map((p) => `${p.security}:${p.currentPrice}`).join(",");
        if (staleDataKey.current === key) return;
        staleDataKey.current = key;
        setRefreshing(true);
        api.investments.refreshQuotes().then(() => {
          positions.refetch();
          summary.refetch();
        }).finally(() => setRefreshing(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.status]);

  const investmentAccounts = (accounts.data ?? []).filter(
    (a) => a.type === "investment",
  );

  const filteredTrades = trades.data ?? [];

  const tradesBySecurity = new Map<string, Trade[]>();
  for (const trade of filteredTrades) {
    const existing = tradesBySecurity.get(trade.security) ?? [];
    existing.push(trade);
    tradesBySecurity.set(trade.security, existing);
  }

  function handleSaved() {
    setTradeOpen(false);
    positions.refetch();
    summary.refetch();
    trades.refetch();
  }

  async function handleDeleteTrade(trade: Trade) {
    if (
      !window.confirm(
        `Delete the ${trade.side} of "${trade.security}" from ${formatDate(trade.date)}? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.investments.deleteTrade(trade.id);
      positions.refetch();
      summary.refetch();
      trades.refetch();
    } catch (err) {
      window.alert(message(err));
    }
  }

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      await api.investments.refreshQuotes();
      positions.refetch();
      summary.refetch();
    } catch {
      // silently ignore refresh failures
    } finally {
      setRefreshing(false);
    }
  }

  const invSummary = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Investments</h2>
          <p className="text-sm text-muted-foreground">
            Track your portfolio, trades, and returns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshPrices}
            disabled={refreshing}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button onClick={() => setTradeOpen(true)}>
            <Plus />
            New trade
          </Button>
        </div>
      </div>

      {summary.status === "loading" && <LoadingState label="Loading investments…" />}
      {summary.status === "error" && (
        <ErrorState
          message={summary.error?.message ?? "Failed to load investments."}
          onRetry={summary.refetch}
        />
      )}

      {invSummary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Total invested
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {formatCurrency(invSummary.totalInvested, currency)}
            </p>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Market value
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {invSummary.marketValue !== null
                ? formatCurrency(invSummary.marketValue, currency)
                : "—"}
            </p>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Realized P/L
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight",
                invSummary.realizedPL >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              )}
            >
              {formatCurrency(invSummary.realizedPL, currency)}
            </p>
          </div>
          <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Unrealized P/L
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight",
                invSummary.unrealizedPL !== null
                  ? invSummary.unrealizedPL >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                  : "text-muted-foreground"
              )}
            >
              {invSummary.unrealizedPL !== null
                ? formatCurrency(invSummary.unrealizedPL, currency)
                : "—"}
            </p>
          </div>
        </div>
      )}

      {investmentAccounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedAccount("all")}
            className={cn(
              "h-7 rounded-full px-3 text-sm font-medium transition-colors",
              selectedAccount === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All accounts
          </button>
          {investmentAccounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAccount(a.id)}
              className={cn(
                "h-7 rounded-full px-3 text-sm font-medium transition-colors",
                selectedAccount === a.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-medium">Positions</h3>
        <div className="mt-2">
          {positions.status === "loading" && (
            <LoadingState label="Loading positions…" />
          )}
          {positions.status === "error" && (
            <ErrorState
              message={positions.error?.message ?? "Failed to load positions."}
              onRetry={positions.refetch}
            />
          )}
          {positions.status === "success" &&
            (positions.data ?? []).length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No positions yet"
                description="Record your first buy to start tracking."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Security</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Avg cost</TableHead>
                      <TableHead className="text-right">
                        Current price
                      </TableHead>
                      <TableHead className="text-right">
                        Market value
                      </TableHead>
                      <TableHead className="text-right">
                        Unrealized P/L
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(positions.data ?? []).map((p) => (
                      <PositionRow
                        key={p.security}
                        position={p}
                        currency={currency}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>
      </section>

      {trades.status === "success" && tradesBySecurity.size > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Trade history</h3>
          {[...tradesBySecurity.entries()].map(([security, secTrades]) => (
            <MiniLedger
              key={security}
              trades={secTrades}
              security={security}
              currency={currency}
              onDelete={handleDeleteTrade}
            />
          ))}
        </div>
      )}

      <Sheet open={tradeOpen} onOpenChange={setTradeOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <TradeForm
            accounts={accounts.data ?? []}
            onSaved={handleSaved}
            onCancel={() => setTradeOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <TradeImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          positions.refetch();
          summary.refetch();
          trades.refetch();
        }}
      />
    </div>
  );
}

