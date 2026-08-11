import AccountMenu from "@/components/AccountMenu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation } from "react-router";
import { menuValueFromPath, menus } from "@/utils/menu";

function getTitle(value: string) {
  if (value === "documents") return "Import";
  return menus.find((menu) => menu.value === value)?.label ?? "Finly";
}

export default function TopBar() {
  const { pathname } = useLocation();
  const title = getTitle(menuValueFromPath(pathname));

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:h-[76px] md:px-6">
      <SidebarTrigger className="-ml-2 md:-ml-3" />
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      <AccountMenu />
    </header>
  );
}
