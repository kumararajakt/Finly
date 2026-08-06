import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  valueClassName?: string;
  stripLabel: string;
  stripValue: string;
  action?: ReactNode;
}

export default function SummaryCard({
  label,
  value,
  valueClassName,
  stripLabel,
  stripValue,
  action,
}: SummaryCardProps) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight", valueClassName)}>{value}</p>
      {action}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs">
        <span className="text-muted-foreground">{stripLabel}</span>
        <span className="truncate font-medium tabular-nums">{stripValue}</span>
      </div>
    </div>
  );
}
