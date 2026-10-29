import { Trans, useTranslation } from "react-i18next";
import { useGetCapitalOutlook, getGetCapitalOutlookQueryKey } from "@workspace/api-client-react";
import { useProperty } from "@/contexts/property-context";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  ArrowRight,
  Building2,
} from "lucide-react";
import {
  CustomBarTooltip,
  SummaryCard,
  fmt,
  type CustomTooltipProps,
} from "@/components/capital-outlook/parts";
import { CapitalOutlookLocked } from "@/components/capital-outlook/locked";
import { AssetOutlookCard } from "@/components/capital-outlook/asset-outlook-card";

export default function CapitalOutlook() {
  const { activePropertyId } = useProperty();
  const { t } = useTranslation();
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const currentYear = new Date().getFullYear();
  const locked = !subscriptionLoading && !isBasicPlus(subscription?.tier);

  const { data, isLoading, error } = useGetCapitalOutlook(activePropertyId ?? "", {
    query: {
      queryKey: getGetCapitalOutlookQueryKey(activePropertyId ?? ""),
      enabled: !!activePropertyId && !subscriptionLoading && !locked,
    },
  });

  if (locked) return <CapitalOutlookLocked onUpgrade={openUpgradeModal} />;

  if (!activePropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
        <Building2 className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">{t("capitalOutlook.selectProperty")}</p>
      </div>
    );
  }

  if (subscriptionLoading || isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center py-20 text-muted-foreground">
        <AlertTriangle className="mx-auto h-10 w-10 mb-3 text-destructive/50" />
        <p>{t("capitalOutlook.loadFailed")}</p>
      </div>
    );
  }

  // Trim timeline to show only years with activity ± a window, max 15 years
  const activeYears = data.timeline.filter((e) => e.projectedCost > 0).map((e) => e.year);
  const maxYear = activeYears.length ? Math.min(Math.max(...activeYears) + 1, currentYear + 15) : currentYear + 10;
  const chartData = data.timeline.filter((e) => e.year <= maxYear);

  // Sort assets: unknown last, then by yearsRemaining ascending
  const sortedAssets = [...data.assets].sort((a, b) => {
    if (a.urgency === "unknown" && b.urgency !== "unknown") return 1;
    if (b.urgency === "unknown" && a.urgency !== "unknown") return -1;
    return (a.yearsRemaining ?? 999) - (b.yearsRemaining ?? 999);
  });

  const assetsWithCost = data.assets.filter((a) => a.replacementCost != null);
  const criticalCount = data.assets.filter((a) => a.urgency === "critical").length;
  const warningCount  = data.assets.filter((a) => a.urgency === "warning").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="bg-primary/10 p-2 rounded-xl">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">{t("capitalOutlook.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("capitalOutlook.subtitle")}
          </p>
        </div>
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
                <AlertTriangle className="h-3 w-3" />
                {t("capitalOutlook.criticalCount", { count: criticalCount })}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="gap-1.5 py-1 px-2.5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                <Clock className="h-3 w-3" />
                {t("capitalOutlook.planAheadCount", { count: warningCount })}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          highlight
          icon={<DollarSign className="h-5 w-5" />}
          label={t("capitalOutlook.totalTrackedValue")}
          value={fmt(data.totalTrackedValue)}
          sub={t("capitalOutlook.acrossAssets", { count: assetsWithCost.length })}
        />
        <SummaryCard
          icon={<Calendar className="h-5 w-5" />}
          label={t("capitalOutlook.next5Years")}
          value={fmt(data.summary.next5YearCost)}
          sub={`${currentYear}–${currentYear + 4}`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t("capitalOutlook.next10Years")}
          value={fmt(data.summary.next10YearCost)}
          sub={`${currentYear}–${currentYear + 9}`}
        />
      </div>

      {/* Next replacement alert */}
      {data.summary.nextReplacement && (
        <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${
          data.summary.nextReplacement.year - currentYear <= 3
            ? "border-destructive/30 bg-destructive/5"
            : "border-amber-200 bg-amber-50/60"
        }`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${
            data.summary.nextReplacement.year - currentYear <= 3 ? "bg-destructive/15" : "bg-amber-100"
          }`}>
            <Clock className={`h-5 w-5 ${data.summary.nextReplacement.year - currentYear <= 3 ? "text-destructive" : "text-amber-600"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {t("capitalOutlook.nextUp")} <span className="text-primary">{data.summary.nextReplacement.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Trans
                i18nKey={data.summary.nextReplacement.year - currentYear <= 0 ? "capitalOutlook.nextReplacementOverdue" : "capitalOutlook.nextReplacementIn"}
                values={{
                  year: data.summary.nextReplacement.year,
                  count: data.summary.nextReplacement.year - currentYear,
                  cost: fmt(data.summary.nextReplacement.cost),
                }}
                components={{ strong: <strong /> }}
              />
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Timeline Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t("capitalOutlook.timelineTitle")}
          </CardTitle>
          <CardDescription>{t("capitalOutlook.timelineDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {chartData.some((d) => d.projectedCost > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={(props) => (
                    <CustomBarTooltip
                      active={props.active}
                      payload={props.payload as CustomTooltipProps["payload"]}
                      label={props.label as number | undefined}
                      data={chartData}
                    />
                  )}
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                />
                <ReferenceLine x={currentYear} stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: t("capitalOutlook.today"), position: "top", fontSize: 10, fill: "hsl(var(--primary))" }} />
                <Bar dataKey="projectedCost" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {chartData.map((entry) => {
                    const yr = entry.year;
                    const diff = yr - currentYear;
                    const color = diff <= 0 ? "#ef4444" : diff <= 3 ? "#f59e0b" : diff <= 8 ? "#3b82f6" : "#22c55e";
                    return <Cell key={yr} fill={color} fillOpacity={entry.projectedCost > 0 ? 1 : 0.15} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center gap-3">
              <TrendingUp className="h-10 w-10 text-muted-foreground/25" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("capitalOutlook.noData")}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t("capitalOutlook.noDataDesc")}</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {[
              { color: "#ef4444", label: t("capitalOutlook.legend.overdue") },
              { color: "#f59e0b", label: t("capitalOutlook.legend.within3") },
              { color: "#3b82f6", label: t("capitalOutlook.legend.fourToEight") },
              { color: "#22c55e", label: t("capitalOutlook.legend.ninePlus") },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Asset Cards */}
      <div>
        <h2 className="text-base font-semibold mb-3">{t("capitalOutlook.assetBreakdown")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sortedAssets.map((asset) => (
            <AssetOutlookCard key={asset.id} asset={asset} propertyId={activePropertyId} />
          ))}
        </div>

        {data.assets.length === 0 && (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("capitalOutlook.noAssets")}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t("capitalOutlook.noAssetsDesc")}</p>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {t("capitalOutlook.disclaimer")}
      </p>
    </div>
  );
}
