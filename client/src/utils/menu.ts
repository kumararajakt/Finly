import {
  LayoutDashboard,
  ArrowRightLeft,
  CalendarClock,
  Repeat,
  PiggyBank,
  Target,
  ListChecks,
  Settings,
} from "lucide-react";

export const menus = [
  {
    label: "Dashboard",
    value: "dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Transactions",
    value: "transactions",
    icon: ArrowRightLeft,
  },
  {
    label: "Recurring",
    value: "recurring",
    icon: CalendarClock,
  },
  {
    label: "Subscriptions",
    value: "subscriptions",
    icon: Repeat,
  },
  {
    label: "Budgets",
    value: "budgets",
    icon: PiggyBank,
  },
  {
    label: "Goals",
    value: "goals",
    icon: Target,
  },
  {
    label: "Rules",
    value: "rules",
    icon: ListChecks,
  },
  {
    label: "Settings",
    value: "settings",
    icon: Settings,
  },
] as const;

export type MenuValue = (typeof menus)[number]["value"] | "documents";
