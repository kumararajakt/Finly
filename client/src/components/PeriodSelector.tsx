import { useId, useState } from "react";
import { CalendarRange } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { PERIODS, periodLabel } from "@/lib/format";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  className?: string;
}

export default function PeriodSelector({ className }: PeriodSelectorProps) {
  const { settings, setPeriod, status } = useSettings();
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectId = useId();

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value as Period;
    setSaveError(null);
    try {
      await setPeriod(value);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save period.");
    }
  }

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={selectId} className="sr-only">
        Date period
      </label>
      <div className="relative">
        <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          id={selectId}
          value={settings.selectedPeriod}
          onChange={handleChange}
          disabled={status === "loading"}
          aria-label="Date period"
          className="h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-background py-1 pl-8 pr-8 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {PERIODS.map((period) => (
            <option key={period} value={period}>
              {periodLabel(period)}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {saveError && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {saveError}
        </p>
      )}
    </div>
  );
}
