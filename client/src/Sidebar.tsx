import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Home } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { menuPath, menuValueFromPath, menus } from "./utils/menu";
import { resolveSettingsSection, settingsSections } from "./utils/settings-menu";

interface AppSidebarProps {
  children: ReactNode;
}

/**
 * Replaces the app-wide menu while `/settings` is open: the settings sections
 * become the navigation. The header doubles as the way back out, since the
 * usual sidebar entries are not on screen while this is.
 */
const SettingsNav = () => {
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = resolveSettingsSection(searchParams.get("section"));

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => {
                setOpenMobile(false);
                navigate(menuPath("dashboard"));
              }}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Home className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Finly</span>
                <span className="truncate text-xs text-muted-foreground">
                  Back to overview
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsSections.map((section) => (
                <SidebarMenuItem key={section.value}>
                  <SidebarMenuButton
                    isActive={section.value === active}
                    onClick={() => {
                      setOpenMobile(false);
                      setSearchParams({ section: section.value });
                    }}
                  >
                    <section.icon
                      className={section.destructive ? "text-destructive" : undefined}
                    />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
};

const SidebarNav = () => {
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSelect = (value: string) => {
    setOpenMobile(false);
    navigate(menuPath(value));
  };

  const isActive = (value: string) => pathname === menuPath(value);

  // Settings gets its own section list instead of the app-wide menu.
  if (menuValueFromPath(pathname) === "settings") {
    return <SettingsNav />;
  }

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Home className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Finly</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menus
                .filter((menu) => menu.value !== "settings")
                .map((menu) => (
                  <SidebarMenuItem key={menu.value}>
                    <SidebarMenuButton
                      isActive={isActive(menu.value)}
                      onClick={() => handleSelect(menu.value)}
                    >
                      <menu.icon />
                      <span>{menu.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {menus
            .filter((menu) => menu.value === "settings")
            .map((menu) => (
              <SidebarMenuItem key={menu.value}>
                <SidebarMenuButton
                  isActive={isActive(menu.value)}
                  onClick={() => handleSelect(menu.value)}
                >
                  <menu.icon />
                  <span>{menu.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
};

const AppSidebar = (props: AppSidebarProps) => {
  const { children } = props;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav />
      </Sidebar>

      {/* min-h-0: a flex item defaults to min-height:auto, which would let
          main grow past the fixed-height wrapper instead of shrinking to it. */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </main>
    </SidebarProvider>
  );
};

export default AppSidebar;
