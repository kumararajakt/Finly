import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { CategorySlice } from "@/lib/types";

const PALETTE = [
  "#6558D3",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#64748b",
];

interface CategoryDonutProps {
  data: CategorySlice[];
  currency: string;
}

export default function CategoryDonut({ data, currency }: CategoryDonutProps) {
  const total = data.reduce((sum, slice) => sum + slice.amount, 0);
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
            data.map((slice, i) => {
              const dash = (slice.amount / total) * circumference;
              const element = (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={PALETTE[i % PALETTE.length]}
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
        {data.map((slice, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
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
