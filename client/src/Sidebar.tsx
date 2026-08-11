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
import { useLocation, useNavigate } from "react-router";
import { menuPath, menus } from "./utils/menu";

interface AppSidebarProps {
  children: ReactNode;
}

const SidebarNav = () => {
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSelect = (value: string) => {
    setOpenMobile(false);
    navigate(menuPath(value));
  };

  const isActive = (value: string) => pathname === menuPath(value);

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

      <main className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </SidebarProvider>
  );
};

export default AppSidebar;
