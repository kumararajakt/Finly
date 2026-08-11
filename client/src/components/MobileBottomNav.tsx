import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { menuPath, menus } from "@/utils/menu";

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden"
    >
      <div className="no-scrollbar flex overflow-x-auto">
        {menus.map((menu) => {
          const active = pathname === menu.path;
          return (
            <button
              key={menu.value}
              type="button"
              onClick={() => navigate(menuPath(menu.value))}
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
