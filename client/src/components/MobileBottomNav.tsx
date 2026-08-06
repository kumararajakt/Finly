import { menus } from "@/utils/menu";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  selectedMenu: string;
  onSelectMenu: (value: string) => void;
}

export default function MobileBottomNav({
  selectedMenu,
  onSelectMenu,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden"
    >
      <div className="no-scrollbar flex overflow-x-auto">
        {menus.map((menu) => {
          const active = selectedMenu === menu.value;
          return (
            <button
              key={menu.value}
              type="button"
              onClick={() => onSelectMenu(menu.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[72px] flex-1 flex-col items-center gap-1 px-3 py-2.5 text-[11px] transition-colors",
                active
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <menu.icon className="size-5" />
              <span className="whitespace-nowrap">{menu.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
