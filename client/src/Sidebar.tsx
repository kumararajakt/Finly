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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Home, Settings, User } from "lucide-react";
import type { ReactNode } from "react";
import { menus } from "./utils/menu";

interface AppSidebarProps {
  children: ReactNode;
  selectedMenu: string;
  setSelectedMenu: React.Dispatch<React.SetStateAction<string>>;
}

const AppSidebar = (props: AppSidebarProps) => {

  const { selectedMenu, setSelectedMenu } = props


  const menuItems = () => {
    return menus.map((menu) =>
      <SidebarMenuItem key={menu.value}>
        <SidebarMenuButton isActive={selectedMenu === menu.value}>
          <menu.icon />
          <span onClick={() => setSelectedMenu(menu.value)}>{menu.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }



  return (
    <SidebarProvider>
      <Sidebar>
        {/* Sidebar Header */}
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

        {/* Sidebar Content */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems()}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1">
        <SidebarTrigger />
        <div className="p-4">{props.children}</div>
      </main>
    </SidebarProvider>
  );
};

export default AppSidebar;
