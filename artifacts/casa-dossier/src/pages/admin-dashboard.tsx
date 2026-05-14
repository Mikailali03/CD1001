import { LayoutDashboard, Users, Building2, Wrench, BarChart3, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/admin/overview-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { CommunicationHubTab } from "@/components/admin/communication-hub-tab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

function PlaceholderTab({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-dashed opacity-70 max-w-lg mx-auto mt-8">
      <CardHeader className="pb-3 text-center">
        <div className="mx-auto mb-2 p-3 rounded-xl bg-muted w-fit">{icon}</div>
        <CardTitle className="text-base text-muted-foreground">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center pb-6">
        <Badge variant="secondary" className="text-xs font-semibold">Coming Soon</Badge>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Dashboard</h1>
            <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground">Platform-wide management and communication tools.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Back to App
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <div className="bg-primary/10 p-3 rounded-xl">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2">
            <Mail className="h-4 w-4" />
            Communication Hub
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-2">
            <Building2 className="h-4 w-4" />
            Properties
          </TabsTrigger>
          <TabsTrigger value="technicians" className="gap-2">
            <Wrench className="h-4 w-4" />
            Technicians
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UsersTab />
          </TabsContent>

          <TabsContent value="communication" className="mt-0">
            <CommunicationHubTab />
          </TabsContent>

          <TabsContent value="properties" className="mt-0">
            <PlaceholderTab
              icon={<Building2 className="h-6 w-6 text-muted-foreground" />}
              title="Property Overview"
              description="Browse all properties on the platform, see dossier health scores, and flag properties needing review."
            />
          </TabsContent>

          <TabsContent value="technicians" className="mt-0">
            <PlaceholderTab
              icon={<Wrench className="h-6 w-6 text-muted-foreground" />}
              title="Technician Verification"
              description="Review technician applications, verify credentials, and manage technician numbers and service histories."
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <PlaceholderTab
              icon={<BarChart3 className="h-6 w-6 text-muted-foreground" />}
              title="Platform Analytics"
              description="Track platform growth, service record volume, marketplace activity, and subscription metrics over time."
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
