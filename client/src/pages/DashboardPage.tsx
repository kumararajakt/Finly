import { Suspense, lazy, useMemo } from "react";
import { CheckCircle2, Flag, Sparkles, TrendingUp, Upload, ArrowRight } from "lucide-react";
import PeriodSelector from "@/components/PeriodSelector";
import SummaryCard from "@/components/SummaryCard";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import LoadingState from "@/components/ui/loading-state";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatPercent, formatSignedAmount } from "@/lib/format";
import type { Summary } from "@/lib/types";
import { cn } from "@/lib/utils";

const CashFlowChart = lazy(() => import("@/components/charts/CashFlowChart"));
const CategoryDonut = lazy(() => import("@/components/charts/CategoryDonut"));

function ChartFallback() {
  return (
    <div
      role="status"
      className="flex h-64 items-center justify-center text-sm text-muted-foreground"
    >
      Loading chart…
    </div>
  );
}

interface DashboardPageProps {
  onNavigate?: (value: string) => void;
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function InsightList({ summary }: { summary: Summary }) {
  const insights = useMemo(() => {
    const items: { icon: typeof Flag; text: string }[] = [];
    if (summary.needsReviewCount > 0) {
      items.push({
        icon: Flag,
        text: `${summary.needsReviewCount} transaction${summary.needsReviewCount === 1 ? "" : "s"} need${summary.needsReviewCount === 1 ? "s" : ""} review`,
      });
    }
    if (summary.pendingSuggestions > 0) {
      items.push({
        icon: Sparkles,
        text: `${summary.pendingSuggestions} detection suggestion${summary.pendingSuggestions === 1 ? "" : "s"} pending`,
      });
    }
    if (summary.lastImport) {
      const last = summary.lastImport;
      items.push({
        icon: Upload,
        text: `Last import: ${last.inserted} inserted, ${last.duplicates} duplicate, ${last.skipped} skipped, ${last.needsReview} to review`,
      });
    }
    if (items.length === 0) {
      items.push({ icon: CheckCircle2, text: "No outstanding actions. Everything looks good." });
    }
    return items;
  }, [summary]);

  return (
    <ul className="mt-3 space-y-2">
      {insights.map((insight, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <insight.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{insight.text}</span>
        </li>
      ))}
    </ul>
  );
}

function NetWorthBreakdownStrip({
  breakdown,
  currency,
}: {
  breakdown: Summary["netWorthBreakdown"];
  currency: string;
}) {
  const segments: { label: string; value: number; color: string }[] = [
    { label: "Cash", value: breakdown.cash, color: "text-emerald-600" },
    { label: "Investments", value: breakdown.investments, color: "text-purple-600" },
    { label: "Credit", value: breakdown.credit, color: "text-red-600" },
    { label: "Other", value: breakdown.other, color: "text-blue-600" },
  ].filter((s) => s.value !== 0);

  if (segments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {segments.map((s) => (
        <span key={s.label} className={cn("tabular-nums", s.color)}>
          {s.label}: {formatCurrency(s.value, currency)}
        </span>
      ))}
    </div>
  );
}

function ComingUp({
  summary,
  currency,
  onNavigate,
}: {
  summary: Summary;
  currency: string;
  onNavigate?: (value: string) => void;
}) {
  if (summary.comingUp.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 py-1">
        <p className="text-sm text-muted-foreground">Nothing is due in the next 7 days.</p>
        <button
          type="button"
          onClick={() => onNavigate?.("recurring")}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View recurring payments
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <ul className="mt-1 divide-y">
      {summary.comingUp.map((item, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.kind === "subscription" ? "Subscription" : "Recurring"} · {item.category} ·{" "}
              {formatDate(item.date)}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {formatCurrency(item.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { settings } = useSettings();
  const period = settings.selectedPeriod;
  const currency = settings.currency;

  const { status, data: summary, error, refetch } = useQuery<Summary>(
    () => api.summary.get(period),
    [period, settings.customDateFrom, settings.customDateTo]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            A snapshot of your finances for the selected period.
          </p>
        </div>
        <PeriodSelector />
      </div>

      {status === "loading" && <LoadingState label="Loading your dashboard…" />}
      {status === "error" && (
        <ErrorState
          message={error?.message ?? "Failed to load your dashboard."}
          onRetry={refetch}
        />
      )}
      {status === "success" && summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Net Worth"
              value={formatCurrency(summary.netWorth, currency)}
              valueClassName={
                summary.netWorth < 0 ? "text-red-600" : undefined
              }
              stripLabel="Cash + Investments − Credit + Other"
              stripValue={formatCurrency(summary.netWorth, currency)}
              action={
                <NetWorthBreakdownStrip
                  breakdown={summary.netWorthBreakdown}
                  currency={currency}
                />
              }
            />
            <SummaryCard
              label="Income"
              value={formatCurrency(summary.income, currency)}
              valueClassName="text-emerald-600"
              stripLabel="Income − Spending"
              stripValue={formatCurrency(summary.income - summary.spending, currency)}
            />
            <SummaryCard
              label="Spending"
              value={formatCurrency(summary.spending, currency)}
              valueClassName="text-orange-600"
              stripLabel="Spending / Income"
              stripValue={
                summary.income > 0
                  ? `${formatPercent(safePercent(summary.spending, summary.income))} of income`
                  : "No income in period"
              }
            />
            <SummaryCard
              label="Savings rate"
              value={formatPercent(summary.savingsRate)}
              valueClassName="text-sky-600"
              stripLabel="Savings / Income"
              stripValue={
                summary.income > 0
                  ? formatCurrency(summary.income - summary.spending, currency)
                  : "No income in period"
              }
            />
          </div>

          {summary.netWorthBreakdown.investments !== 0 && (
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-purple-600" aria-hidden="true" />
                <h3 className="text-sm font-medium">Investments</h3>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Market value:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(summary.netWorthBreakdown.investments, currency)}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("investments")}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                View investments
                <ArrowRight className="size-3.5" />
              </button>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Cash flow</h3>
              <div className="mt-4">
                {summary.cashFlow.length === 0 ? (
                  <EmptyState description="Import or add transactions to see cash flow." />
                ) : (
                  <Suspense fallback={<ChartFallback />}>
                    <CashFlowChart data={summary.cashFlow} currency={currency} />
                  </Suspense>
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Spending by category</h3>
              <div className="mt-4">
                {summary.categoryBreakdown.length === 0 ? (
                  <EmptyState description="No spending yet in this period." />
                ) : (
                  <Suspense fallback={<ChartFallback />}>
                    <CategoryDonut data={summary.categoryBreakdown} currency={currency} />
                  </Suspense>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Recent activity</h3>
              {summary.recentActivity.length === 0 ? (
                <EmptyState description="No activity in this period." />
              ) : (
                <ul className="mt-1 divide-y">
                  {summary.recentActivity.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tx.merchant}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.category} · {tx.fromAccount}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-medium tabular-nums",
                          tx.type === "income"
                            ? "text-emerald-600"
                            : tx.type === "transfer"
                              ? "text-muted-foreground"
                              : "text-foreground"
                        )}
                      >
                        {formatSignedAmount(tx.amount, tx.type, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Finly insight</h3>
              <InsightList summary={summary} />
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Coming up</h3>
              <ComingUp summary={summary} currency={currency} onNavigate={onNavigate} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
