import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetAdminAnalytics, getGetAdminAnalyticsQueryKey } from "@workspace/api-client-react";

const CHART_COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  completed: "Completed",
};

const TIER_LABELS: Record<string, string> = {
  essential: "Essential",
  managed: "Managed",
  concierge: "Concierge",
};

function ChartSkeleton() {
  return <Skeleton className="h-52 w-full rounded-lg" />;
}

export function AnalyticsTab() {
  const { data, isLoading } = useGetAdminAnalytics({
    query: { queryKey: getGetAdminAnalyticsQueryKey() },
  });

  return (
    <div className="space-y-6">
      {/* Row 1 — time series */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New Users by Month</CardTitle>
            <CardDescription className="text-xs">Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !data?.usersByMonth?.length ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.usersByMonth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS[0] }}
                    name="Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Service records over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Service Records by Month</CardTitle>
            <CardDescription className="text-xs">Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !data?.serviceRecordsByMonth?.length ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.serviceRecordsByMonth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Records" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — distributions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Jobs by status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Marketplace Jobs by Status</CardTitle>
            <CardDescription className="text-xs">All time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !data?.jobsByStatus?.length ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No marketplace jobs yet
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.jobsByStatus.map((d) => ({
                        ...d,
                        label: STATUS_LABELS[d.label] ?? d.label,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {data.jobsByStatus.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {data.jobsByStatus.map((d, idx) => (
                    <div key={d.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">
                          {STATUS_LABELS[d.label] ?? d.label}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions by tier */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscriptions by Tier</CardTitle>
            <CardDescription className="text-xs">Active subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !data?.subscriptionsByTier?.length ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No subscriptions yet
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.subscriptionsByTier.map((d) => ({
                        ...d,
                        label: TIER_LABELS[d.label] ?? d.label,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {data.subscriptionsByTier.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {data.subscriptionsByTier.map((d, idx) => (
                    <div key={d.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">
                          {TIER_LABELS[d.label] ?? d.label}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
