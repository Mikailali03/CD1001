import { Users, Building2, Wrench, FileText, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetAdminStats, getGetAdminStatsQueryKey } from "@workspace/api-client-react";

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="hover-elevate transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground font-medium">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className="text-3xl font-bold tracking-tight">{value?.toLocaleString() ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewTab() {
  const { data: stats, isLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });

  const cards = [
    {
      label: "Total Users",
      value: stats?.totalUsers,
      icon: <Users className="h-5 w-5 text-primary/60" />,
    },
    {
      label: "Properties",
      value: stats?.totalProperties,
      icon: <Building2 className="h-5 w-5 text-primary/60" />,
    },
    {
      label: "Active Technicians",
      value: stats?.totalTechnicians,
      icon: <Wrench className="h-5 w-5 text-primary/60" />,
    },
    {
      label: "Service Records",
      value: stats?.totalServiceRecords,
      icon: <FileText className="h-5 w-5 text-primary/60" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={isLoading} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-dashed opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Growth Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              Analytics charts coming soon
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              Activity feed coming soon
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
