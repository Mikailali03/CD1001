import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useProperty } from "@/contexts/property-context";
import { useSubscription } from "@/contexts/subscription-context";
import { WelcomeModal } from "./welcome-modal";
import { UpgradeModal } from "./upgrade-modal";
import { PendingInvitesModal } from "./pending-invites-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, Check, Plus, FileText, LogOut, User, Zap, Shield, Star, Crown, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";

function PropertySwitcher() {
  const { activeProperty, properties, setActivePropertyId } = useProperty();

  if (properties.length === 0) {
    return (
      <Link href="/properties">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add a property
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 max-w-[180px] sm:max-w-[260px] bg-background text-sm font-medium"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeProperty?.name ?? "Select property"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your Properties
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {properties.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => setActivePropertyId(p.id)}
            className="flex items-start gap-3 py-2.5 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[p.address, p.city, p.state].filter(Boolean).join(", ")}
              </p>
            </div>
            {p.id === activeProperty?.id && (
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/properties" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            Manage My Properties
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GenerateReportButton() {
  const { activeProperty } = useProperty();
  if (!activeProperty) return null;
  return (
    <Link href={`/properties/${activeProperty.id}/report`}>
      <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-medium hidden sm:inline-flex">
        <FileText className="h-3.5 w-3.5" />
        Generate Report
      </Button>
    </Link>
  );
}

const TIER_CONFIG = {
  essential: {
    label: "Essential",
    icon: <Shield className="h-3 w-3" />,
    className: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
  },
  basic: {
    label: "Basic",
    icon: <Star className="h-3 w-3" />,
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  managed: {
    label: "Managed",
    icon: <Star className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100/80 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  concierge: {
    label: "Concierge",
    icon: <Crown className="h-3 w-3" />,
    className: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100/80 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
};

function SubscriptionBadge() {
  const { subscription, openUpgradeModal } = useSubscription();
  if (!subscription) return null;

  const tier = subscription.tier;
  const config = TIER_CONFIG[tier];

  return (
    <button
      onClick={openUpgradeModal}
      className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${config.className}`}
      title="Manage subscription"
    >
      {config.icon}
      {config.label}
      {tier === "essential" && <Zap className="h-2.5 w-2.5 ml-0.5" />}
    </button>
  );
}

function UserMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: profile } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey(), retry: false },
  });
  const isAdmin = (profile as { role?: string } | undefined)?.role === "admin";

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user?.emailAddresses?.[0]?.emailAddress ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8 text-xs font-medium">
          <User className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate hidden sm:inline">{displayName}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
          {user?.emailAddresses?.[0]?.emailAddress}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm cursor-pointer text-primary focus:text-primary font-medium"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Admin Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onSelect={() => signOut({ redirectUrl: `${basePath}/` })}
          className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({
  children,
  topBanner,
  forceWelcomeModal,
}: {
  children: React.ReactNode;
  topBanner?: React.ReactNode;
  forceWelcomeModal?: boolean;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-dvh w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {topBanner}
          <header
            className="sticky z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            style={{ top: topBanner ? "40px" : "0px" }}
          >
            <SidebarTrigger className="h-8 w-8 shrink-0 md:hidden" />
            <div className="flex-1 min-w-0">
              <PropertySwitcher />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SubscriptionBadge />
              <GenerateReportButton />
              <UserMenu />
            </div>
          </header>
          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
      <WelcomeModal forceOpen={forceWelcomeModal} />
      <PendingInvitesModal />
      <UpgradeModal />
    </SidebarProvider>
  );
}
