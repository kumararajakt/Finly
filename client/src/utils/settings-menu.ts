import {
  AlertTriangle,
  FolderOpen,
  LayoutGrid,
  RotateCcw,
  Tags,
  Wallet,
} from "lucide-react";

/**
 * Settings has its own sidebar — `Sidebar.tsx` swaps it in on `/settings` — so
 * the sections that used to be accordion items are the navigation itself. The
 * active section lives in the `section` search param, which both the sidebar
 * and `SettingsPage` read through `resolveSettingsSection`, so the two can
 * never disagree about what is open.
 */
export const settingsSections = [
  { value: "net-worth", label: "Net worth", icon: Wallet, destructive: false },
  { value: "density", label: "Layout density", icon: LayoutGrid, destructive: false },
  { value: "categories", label: "Categories", icon: FolderOpen, destructive: false },
  { value: "tags", label: "Tags", icon: Tags, destructive: false },
  { value: "recovery", label: "Recovery", icon: RotateCcw, destructive: false },
  { value: "delete", label: "Delete account", icon: AlertTriangle, destructive: true },
] as const;

export type SettingsSectionValue = (typeof settingsSections)[number]["value"];

/** Shown when no `section` param is set, or when it names a section that no longer exists. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionValue = "net-worth";

export function resolveSettingsSection(
  raw: string | null | undefined,
): SettingsSectionValue {
  return settingsSections.some((section) => section.value === raw)
    ? (raw as SettingsSectionValue)
    : DEFAULT_SETTINGS_SECTION;
}
