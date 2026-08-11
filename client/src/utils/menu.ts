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
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Transactions",
    value: "transactions",
    path: "/transactions",
    icon: ArrowRightLeft,
  },
  {
    label: "Recurring",
    value: "recurring",
    path: "/recurring",
    icon: CalendarClock,
  },
  {
    label: "Subscriptions",
    value: "subscriptions",
    path: "/subscriptions",
    icon: Repeat,
  },
  {
    label: "Budgets",
    value: "budgets",
    path: "/budgets",
    icon: PiggyBank,
  },
  {
    label: "Goals",
    value: "goals",
    path: "/goals",
    icon: Target,
  },
  {
    label: "Rules",
    value: "rules",
    path: "/rules",
    icon: ListChecks,
  },
  {
    label: "Settings",
    value: "settings",
    path: "/settings",
    icon: Settings,
  },
] as const;

export type MenuValue = (typeof menus)[number]["value"] | "documents";

export const DOCUMENTS_PATH = "/documents";

export function menuPath(value: string): string {
  if (value === "documents") return DOCUMENTS_PATH;
  return menus.find((menu) => menu.value === value)?.path ?? `/${value}`;
}

export function menuValueFromPath(path: string): string {
  if (path === DOCUMENTS_PATH) return "documents";
  return menus.find((menu) => menu.path === path)?.value ?? path.replace(/^\//, "");
}
