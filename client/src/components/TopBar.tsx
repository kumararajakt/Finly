import AccountMenu from "@/components/AccountMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { menus } from "@/utils/menu";

interface TopBarProps {
  selectedMenu: string;
}

function getTitle(value: string) {
  if (value === "documents") return "Import";
  return menus.find((menu) => menu.value === value)?.label ?? "Finly";
}

export default function TopBar({ selectedMenu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:h-[76px] md:px-6">
      <SidebarTrigger className="-ml-2 md:-ml-3" />
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
        {getTitle(selectedMenu)}
      </h1>
      <ThemeToggle />
      <AccountMenu />
    </header>
  );
}
