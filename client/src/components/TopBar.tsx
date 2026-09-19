import { Upload } from "lucide-react";
import { useLocation } from "react-router";
import AccountMenu from "@/components/AccountMenu";
import AppearanceSheet from "@/components/AppearanceSheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { menuValueFromPath, menus } from "@/utils/menu";

export default function TopBar() {
  const { pathname } = useLocation();
  const value = menuValueFromPath(pathname);
  const menu = menus.find((item) => item.value === value);
  const title = menu?.label ?? (value === "documents" ? "Import" : "Finly");
  const Icon = menu?.icon ?? (value === "documents" ? Upload : undefined);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:h-[76px] md:px-6">
      <SidebarTrigger className="-ml-2 md:-ml-3" />
      <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold">
        {Icon ? <Icon className="size-4 shrink-0" /> : null}
        <span className="min-w-0 truncate">{title}</span>
      </h1>
      <AppearanceSheet />
      <AccountMenu />
    </header>
  );
}