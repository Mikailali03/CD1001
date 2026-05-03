import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useProperty } from "@/contexts/property-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, Check, Plus, FileText } from "lucide-react";
import { Link } from "wouter";

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
          className="gap-2 h-8 max-w-[260px] bg-background text-sm font-medium"
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
            Add another property
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
      <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-medium">
        <FileText className="h-3.5 w-3.5" />
        Generate Report
      </Button>
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />
            <div className="w-px h-5 bg-border" />
            <PropertySwitcher />
            <div className="ml-auto">
              <GenerateReportButton />
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
