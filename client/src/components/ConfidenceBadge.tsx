import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: "high" | "likely";
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        confidence === "high"
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-amber-500/10 text-amber-600"
      )}
    >
      {confidence === "high" ? "High" : "Likely"}
    </span>
  );
}
