import { LayoutDashboard, Users, Building2, Wrench, BarChart3, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/admin/overview-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { CommunicationHubTab } from "@/components/admin/communication-hub-tab";
import { PropertiesTab } from "@/components/admin/properties-tab";
import { TechniciansTab } from "@/components/admin/technicians-tab";
import { AnalyticsTab } from "@/components/admin/analytics-tab";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

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
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/dashboard">
              Back to App
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
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
            <PropertiesTab />
          </TabsContent>

          <TabsContent value="technicians" className="mt-0">
            <TechniciansTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AnalyticsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
