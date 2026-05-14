import { LayoutDashboard, Users, Building2, Wrench, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const PLACEHOLDER_STATS = [
  { label: "Total Users", value: "—", icon: <Users className="h-5 w-5 text-muted-foreground" /> },
  { label: "Properties", value: "—", icon: <Building2 className="h-5 w-5 text-muted-foreground" /> },
  { label: "Active Technicians", value: "—", icon: <Wrench className="h-5 w-5 text-muted-foreground" /> },
  { label: "Verified Records", value: "—", icon: <ShieldCheck className="h-5 w-5 text-muted-foreground" /> },
];

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Dashboard</h1>
            <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground">Platform-wide overview and management tools.</p>
        </div>
        <div className="bg-primary/10 p-3 rounded-xl">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map((stat) => (
          <Card key={stat.label} className="hover-elevate transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                {stat.icon}
              </div>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming soon panels */}
      <div className="grid gap-6 md:grid-cols-2">
        {[
          {
            title: "User Management",
            description: "View, search, and manage all homeowner and technician accounts. Assign roles and review account activity.",
            icon: <Users className="h-5 w-5" />,
          },
          {
            title: "Property Overview",
            description: "Browse all properties on the platform, see dossier health scores, and flag properties needing review.",
            icon: <Building2 className="h-5 w-5" />,
          },
          {
            title: "Technician Verification",
            description: "Review technician applications, verify credentials, and manage technician numbers and service histories.",
            icon: <Wrench className="h-5 w-5" />,
          },
          {
            title: "Platform Analytics",
            description: "Track platform growth, service record volume, marketplace activity, and subscription metrics.",
            icon: <LayoutDashboard className="h-5 w-5" />,
          },
        ].map((panel) => (
          <Card key={panel.title} className="hover-elevate transition-shadow border-dashed opacity-70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                {panel.icon}
                {panel.title}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">{panel.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                Coming Soon
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4">
        <p className="text-sm text-muted-foreground">
          Admin tools are being built. Check back soon.
        </p>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mt-2 gap-1.5 text-xs">
            Back to Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
