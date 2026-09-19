import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { resolveChartColors } from "@/lib/theme-palettes";
import type { CategorySlice } from "@/lib/types";

interface CategoryDonutProps {
  data: CategorySlice[];
  currency: string;
}

/** How many categories get a distinct theme color. */
const MAX_COLORED_SLICES = 5;
/** Neutral color for the aggregated "Other" slice (NOT a theme chart token). */
const OTHER_COLOR = "var(--muted-foreground)";

export default function CategoryDonut({ data, currency }: CategoryDonutProps) {
  const { paletteId, resolved, customTheme } = useTheme();
  const charts = useMemo(
    () => resolveChartColors({ paletteId, resolved, customTheme }),
    [paletteId, resolved, customTheme]
  );
  const total = data.reduce((sum, slice) => sum + slice.amount, 0);

  // Keep the 5 biggest categories in their theme colors and fold the rest
  // into a single muted "Other" slice, so no color is ever reused. This is
  // the same shape as TweakCN's 5-slice donut.
  const slices = useMemo(() => {
    if (data.length <= MAX_COLORED_SLICES) return data;
    const top = data.slice(0, MAX_COLORED_SLICES);
    const rest = data.slice(MAX_COLORED_SLICES);
    const otherAmount = rest.reduce((sum, slice) => sum + slice.amount, 0);
    return [
      ...top,
      {
        category: "Other",
        amount: otherAmount,
        percentage: total > 0 ? (otherAmount / total) * 100 : 0,
      },
    ];
  }, [data, total]);

  const sliceColor = (index: number) =>
    index < charts.length ? charts[index] : OTHER_COLOR;

  const radius = 40;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            slices.map((slice, i) => {
              const dash = (slice.amount / total) * circumference;
              const element = (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={sliceColor(i)}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return element;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Spending</span>
          <span className="text-sm font-semibold">{formatCompactCurrency(total, currency)}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2">
        {slices.map((slice, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: sliceColor(i) }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.category}</span>
            <span className="shrink-0 tabular-nums">{formatCurrency(slice.amount, currency)}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
              {Math.round(slice.percentage)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}