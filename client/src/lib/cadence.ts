import type { Cadence } from "./types";

export const CADENCES: Cadence[] = ["weekly", "biweekly", "monthly", "quarterly", "annual"];

export function cadenceLabel(cadence: Cadence): string {
  switch (cadence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "annual":
      return "Annual";
  }
}

export function monthlyEquivalent(amount: number, cadence: Cadence): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    case "monthly":
      return amount;
  }
}
