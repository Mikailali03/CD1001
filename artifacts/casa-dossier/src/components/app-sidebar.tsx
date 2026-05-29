import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
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
  Images,
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const { t } = useTranslation();

  const navigation = [
    { name: t("nav.dashboard"),     href: "/",               icon: LayoutDashboard },
    { name: t("nav.myAssets"),      href: "/assets",         icon: Package },
    { name: t("nav.digitalLocker"), href: "/locker",         icon: Images },
    { name: t("nav.capitalOutlook"),href: "/capital-outlook",icon: TrendingUp },
    { name: t("nav.findAPro"),      href: "/marketplace",    icon: UserSearch },
    { name: t("nav.diyGuides"),     href: "/guides",         icon: BookOpen },
  ];

  function handleNav() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
    >
      <SidebarHeader className="border-b px-3 py-5 overflow-hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-primary rounded-lg p-1.5 shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-base leading-none text-primary whitespace-nowrap">Casa Dossier</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">{t("nav.tagline")}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4 mb-1 group-data-[collapsible=icon]:hidden">
            {t("nav.homeownerPortal")}
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
                      <Link href={item.href} onClick={handleNav} className="flex items-center gap-3">
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
              tooltip={t("nav.settings")}
              className="h-10 px-4 rounded-lg"
            >
              <Link href="/settings" onClick={handleNav} className="flex items-center gap-3">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="font-medium">{t("nav.settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
