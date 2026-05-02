import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Home, Wrench, FileText, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="h-[400px] rounded-xl lg:col-span-4" />
          <Skeleton className="h-[400px] rounded-xl lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Command Center</h1>
        <p className="text-muted-foreground">Your property health and upcoming maintenance overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalProperties}</div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tracked Assets</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-chart-1 font-medium">{dashboard.verifiedAssets} verified</span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboard.overdueTaskCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Action required</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
            <Clock className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.dueSoonTaskCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 flex flex-col hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle>Upcoming Maintenance</CardTitle>
            <CardDescription>Tasks scheduled for your assets</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {dashboard.upcomingTasks && dashboard.upcomingTasks.length > 0 ? (
              <div className="space-y-4">
                {dashboard.upcomingTasks.map(task => (
                  <div key={task.id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{task.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Due {format(new Date(task.nextDueDate), 'MMM d, yyyy')}</span>
                        {task.isDiy && <Badge variant="secondary" className="text-[10px]">DIY</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                <ShieldCheck className="h-8 w-8 text-chart-1 mb-2 opacity-50" />
                <p>All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Service records and updates</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {dashboard.recentRecords && dashboard.recentRecords.length > 0 ? (
              <div className="space-y-4">
                {dashboard.recentRecords.slice(0, 5).map(record => (
                  <div key={record.id} className="flex items-start gap-4">
                    <div className="mt-0.5 bg-secondary p-2 rounded-full">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{record.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.technicianName || record.companyName || 'Service'} • {format(new Date(record.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                <FileText className="h-8 w-8 mb-2 opacity-20" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
