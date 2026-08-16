import { useId, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { PERIODS, periodLabel } from "@/lib/format";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  className?: string;
}

export default function PeriodSelector({ className }: PeriodSelectorProps) {
  const { settings, setPeriod, updateSettings, saveSetting, status } = useSettings();
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectId = useId();
  const fromId = useId();
  const toId = useId();
  const isCustom = settings.selectedPeriod === "custom";

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value as Period;
    setSaveError(null);
    try {
      await setPeriod(value);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save period.");
    }
  }

  async function handleDateChange(
    key: "customDateFrom" | "customDateTo",
    value: string
  ) {
    const previous = settings[key];
    const next = value === "" ? null : value;
    setSaveError(null);
    updateSettings({ [key]: next });
    try {
      await saveSetting(key, next);
    } catch (error) {
      updateSettings({ [key]: previous });
      setSaveError(error instanceof Error ? error.message : "Failed to save date range.");
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <label htmlFor={selectId} className="sr-only">
          Date period
        </label>
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
      {isCustom && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={fromId} className="sr-only">
            From date
          </label>
          <Input
            id={fromId}
            type="date"
            value={settings.customDateFrom ?? ""}
            onChange={(e) => handleDateChange("customDateFrom", e.target.value)}
            className="h-8 w-auto"
          />
          <span className="text-muted-foreground" aria-hidden="true">
            →
          </span>
          <label htmlFor={toId} className="sr-only">
            To date
          </label>
          <Input
            id={toId}
            type="date"
            value={settings.customDateTo ?? ""}
            onChange={(e) => handleDateChange("customDateTo", e.target.value)}
            className="h-8 w-auto"
          />
        </div>
      )}
      {saveError && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {saveError}
        </p>
      )}
    </div>
  );
}
