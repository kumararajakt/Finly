import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { message } from "@/components/transactions/shared";
import {
  formatDate,
  formatSignedAmount,
  PERIODS,
  periodLabel,
  periodStartDate,
  todayISO,
} from "@/lib/format";
import type { Period, TransactionPeer } from "@/lib/types";

export interface PeerPrompt {
  merchant: string;
  /** The category the user just applied to one transaction. */
  category: string;
  /** The merchant's other transactions that are not already in that category. */
  peers: TransactionPeer[];
  currency: string;
  /** Opens on the period the page is showing. */
  period: Period;
  /** The user's saved custom range, for the "Custom" option. */
  custom: { from: string | null; to: string | null };
}

interface PeerCategoryDialogProps {
  prompt: PeerPrompt;
  onOpenChange: (open: boolean) => void;
  /** Receives the ids to re-label. Let it throw to keep the dialog open. */
  onConfirm: (ids: string[], category: string) => Promise<void>;
}

/** Last calendar day of the previous month, as `YYYY-MM-DD`. */
function endOfLastMonth(): string {
  const now = new Date();
  return todayISO(new Date(now.getFullYear(), now.getMonth(), 0));
}

/**
 * Inclusive bounds for a period, mirroring the server's `periodRange` so the
 * count shown here is the count that will change. The rolling windows are
 * complete months (`last-3-months` in September is June–August), which is why
 * they need an explicit upper bound as well as `periodStartDate`'s lower one.
 */
function periodBounds(
  period: Period,
  custom: { from: string | null; to: string | null },
): { start: string | null; end: string | null } {
  if (period === "all-time") return { start: null, end: null };
  // The server resolves an unset custom bound to today, not to "unbounded".
  if (period === "custom") {
    return { start: custom.from, end: custom.to ?? todayISO() };
  }
  const rolling =
    period === "last-month" ||
    period === "last-3-months" ||
    period === "last-6-months";
  return {
    start: periodStartDate(period),
    end: rolling ? endOfLastMonth() : todayISO(),
  };
}

function inPeriod(
  peer: TransactionPeer,
  bounds: { start: string | null; end: string | null },
): boolean {
  // ISO dates sort lexicographically, so these are plain string comparisons.
  if (bounds.start && peer.date < bounds.start) return false;
  if (bounds.end && peer.date > bounds.end) return false;
  return true;
}

/**
 * Offers to extend a category change to the rest of a merchant. This is an
 * offer, not a confirmation of something already done — the single transaction
 * is saved first, and declining here simply ends the flow. Mounted only while a
 * prompt is open, so its state starts fresh every time.
 */
export default function PeerCategoryDialog({
  prompt,
  onOpenChange,
  onConfirm,
}: PeerCategoryDialogProps) {
  const [period, setPeriod] = useState<Period>(prompt.period);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoped = useMemo(
    () => prompt.peers.filter((peer) => inPeriod(peer, periodBounds(period, prompt.custom))),
    [prompt.peers, period, prompt.custom],
  );

  function close() {
    if (!pending) onOpenChange(false);
  }

  async function handleConfirm() {
    if (pending || scoped.length === 0) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(
        scoped.map((peer) => peer.id),
        prompt.category,
      );
      onOpenChange(false);
    } catch (err) {
      setError(message(err));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Also categorise {prompt.merchant}?</DialogTitle>
          <DialogDescription>
            {prompt.peers.length} other {prompt.merchant} transaction
            {prompt.peers.length === 1 ? " has" : "s have"} a different
            category. They can be changed to {prompt.category} too.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="peer-period" className="text-xs font-medium">
              Apply to
            </label>
            <select
              id="peer-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {PERIODS.map((option) => (
                <option key={option} value={option}>
                  {periodLabel(option)} (
                  {
                    prompt.peers.filter((peer) =>
                      inPeriod(peer, periodBounds(option, prompt.custom)),
                    ).length
                  }
                  )
                </option>
              ))}
            </select>
          </div>

          {scoped.length > 0 ? (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs">
              {scoped.map((peer) => (
                <li key={peer.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {formatDate(peer.date)} · {peer.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatSignedAmount(peer.amount, peer.type, prompt.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No {prompt.merchant} transactions in this period. Pick a wider one
              to apply the change.
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Leave them
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending || scoped.length === 0}
          >
            {pending
              ? "Changing…"
              : `Change ${scoped.length} to ${prompt.category}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
