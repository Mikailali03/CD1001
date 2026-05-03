import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  UserSearch,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "My Assets", href: "/assets", icon: Package },
  { name: "Capital Outlook", href: "/capital-outlook", icon: TrendingUp },
  { name: "Find a Pro", href: "/marketplace", icon: UserSearch },
  { name: "DIY Guides", href: "/guides", icon: BookOpen },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { setOpen } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <SidebarHeader className="border-b px-3 py-5 overflow-hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-primary rounded-lg p-1.5 shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-base leading-none text-primary whitespace-nowrap">Casa Dossier</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">Your Home, Documented.</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4 mb-1 group-data-[collapsible=icon]:hidden">
            Homeowner Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      className="h-10 px-4 rounded-lg"
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t pb-4 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              tooltip="Settings"
              className="h-10 px-4 rounded-lg"
            >
              <Link href="/settings" className="flex items-center gap-3">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="font-medium">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
