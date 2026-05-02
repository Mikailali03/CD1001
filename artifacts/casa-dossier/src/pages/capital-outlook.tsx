import { useQuery } from "@tanstack/react-query";
import { useProperty } from "@/contexts/property-context";
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
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AssetOutlook = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  installDate: string | null;
  installYear: number | null;
  replacementCost: number | null;
  expectedLifespanYears: number;
  replacementYear: number | null;
  yearsRemaining: number | null;
  urgency: "critical" | "warning" | "good" | "unknown";
  ageYears: number | null;
  percentLifeUsed: number | null;
};

type TimelineEntry = {
  year: number;
  projectedCost: number;
  assetNames: string[];
};

type CapitalOutlookData = {
  totalTrackedValue: number;
  assets: AssetOutlook[];
  timeline: TimelineEntry[];
  summary: {
    nextReplacement: { name: string; year: number; cost: number } | null;
    next5YearCost: number;
    next10YearCost: number;
  };
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const URGENCY_CONFIG = {
  critical: { label: "Replace Soon", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", bar: "#ef4444" },
  warning:  { label: "Plan Ahead",   color: "text-amber-600",   bg: "bg-amber-50",       border: "border-amber-200",       bar: "#f59e0b" },
  good:     { label: "Good Shape",   color: "text-chart-1",     bg: "bg-chart-1/10",     border: "border-chart-1/20",      bar: "#22c55e" },
  unknown:  { label: "No Data",      color: "text-muted-foreground", bg: "bg-muted",      border: "border-border",          bar: "#94a3b8" },
};

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡", Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

function LifeBar({ percent, urgency }: { percent: number; urgency: AssetOutlook["urgency"] }) {
  const colors = { critical: "bg-destructive", warning: "bg-amber-400", good: "bg-chart-1", unknown: "bg-muted-foreground/30" };
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colors[urgency]}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  data?: TimelineEntry[];
};

function CustomBarTooltip({ active, payload, label, data }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = data?.find((d) => d.year === label);
  return (
    <div className="bg-background border shadow-lg rounded-xl px-4 py-3 text-sm min-w-[180px]">
      <p className="font-bold text-base mb-1">{label}</p>
      <p className="text-primary font-semibold">{fmt(payload[0]!.value)}</p>
      {entry?.assetNames.length ? (
        <div className="mt-2 pt-2 border-t space-y-0.5">
          {entry.assetNames.map((n) => (
            <p key={n} className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />
              {n}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${highlight ? "bg-primary/15" : "bg-muted"}`}>
            <span className={highlight ? "text-primary" : "text-muted-foreground"}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${highlight ? "text-primary" : ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CapitalOutlook() {
  const { activePropertyId } = useProperty();
  const currentYear = new Date().getFullYear();

  const { data, isLoading, error } = useQuery<CapitalOutlookData>({
    queryKey: ["capital-outlook", activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) throw new Error("No property selected");
      const res = await fetch(`${BASE}/api/properties/${activePropertyId}/capital-outlook`);
      if (!res.ok) throw new Error("Failed to load capital outlook");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  if (!activePropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
        <Building2 className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Select a property to view its Capital Outlook.</p>
      </div>
    );
  }

  if (isLoading) {
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
        <p>Could not load Capital Outlook data.</p>
      </div>
    );
  }

  // Trim timeline to show only years with activity ± a window, max 15 years
  const activeYears = data.timeline.filter((t) => t.projectedCost > 0).map((t) => t.year);
  const maxYear = activeYears.length ? Math.min(Math.max(...activeYears) + 1, currentYear + 15) : currentYear + 10;
  const chartData = data.timeline.filter((t) => t.year <= maxYear);

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
            <h1 className="text-3xl font-bold tracking-tight text-primary">Capital Outlook</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Projected replacement costs for your home's major systems — so you're never surprised.
          </p>
        </div>
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="gap-1.5 py-1 px-2.5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                <Clock className="h-3 w-3" />
                {warningCount} plan ahead
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
          label="Total Tracked Replacement Value"
          value={fmt(data.totalTrackedValue)}
          sub={`Across ${assetsWithCost.length} tracked asset${assetsWithCost.length !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          icon={<Calendar className="h-5 w-5" />}
          label="Next 5-Year Projected Spend"
          value={fmt(data.summary.next5YearCost)}
          sub={`${currentYear}–${currentYear + 4}`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Next 10-Year Projected Spend"
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
              Next Up: <span className="text-primary">{data.summary.nextReplacement.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Projected replacement in <strong>{data.summary.nextReplacement.year}</strong>
              {" "}({data.summary.nextReplacement.year - currentYear <= 0
                ? "overdue"
                : `${data.summary.nextReplacement.year - currentYear} year${data.summary.nextReplacement.year - currentYear !== 1 ? "s" : ""} away`})
              {" "}— est. <strong>{fmt(data.summary.nextReplacement.cost)}</strong>
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
            Replacement Cost Timeline
          </CardTitle>
          <CardDescription>Projected year-by-year capital expenditures for your tracked assets</CardDescription>
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
                    <CustomBarTooltip {...props as any} data={chartData} />
                  )}
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                />
                <ReferenceLine x={currentYear} stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Today", position: "top", fontSize: 10, fill: "hsl(var(--primary))" }} />
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
                <p className="text-sm font-medium text-muted-foreground">No replacement data yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add assets with replacement costs to see the timeline</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {[
              { color: "#ef4444", label: "Overdue / Past Due" },
              { color: "#f59e0b", label: "Within 3 years" },
              { color: "#3b82f6", label: "4–8 years" },
              { color: "#22c55e", label: "9+ years" },
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
        <h2 className="text-base font-semibold mb-3">Asset Breakdown</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sortedAssets.map((asset) => {
            const cfg = URGENCY_CONFIG[asset.urgency];
            return (
              <Link key={asset.id} href={`/properties/${activePropertyId}/assets/${asset.id}`}>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow border ${cfg.border}`}>
                  <CardContent className="pt-4 pb-4 px-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICONS[asset.category] ?? "📦"}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight line-clamp-1">{asset.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[asset.brand, asset.model].filter(Boolean).join(" · ") || asset.category}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px] font-semibold shrink-0 whitespace-nowrap`}>
                        {asset.urgency === "critical" && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                        {asset.urgency === "good" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Life bar */}
                    {asset.percentLifeUsed != null && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Life used: {asset.percentLifeUsed}%</span>
                          <span>{asset.expectedLifespanYears}yr lifespan</span>
                        </div>
                        <LifeBar percent={asset.percentLifeUsed} urgency={asset.urgency} />
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                      <div>
                        <p className="text-muted-foreground">Installed</p>
                        <p className="font-medium">{asset.installYear ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Replace by</p>
                        <p className={`font-semibold ${asset.urgency === "critical" ? "text-destructive" : asset.urgency === "warning" ? "text-amber-600" : ""}`}>
                          {asset.replacementYear ?? "—"}
                          {asset.yearsRemaining != null && (
                            <span className="font-normal text-muted-foreground">
                              {" "}({asset.yearsRemaining <= 0 ? "past" : `${asset.yearsRemaining}yr`})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Est. Cost</p>
                        <p className="font-semibold">
                          {asset.replacementCost != null ? fmt(asset.replacementCost) : <span className="text-muted-foreground font-normal">—</span>}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {data.assets.length === 0 && (
          <div className="text-center py-16 border border-dashed rounded-xl">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No assets to analyze</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add assets to your property to see capital projections</p>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        Replacement timelines are estimates based on industry-standard lifespans. Actual lifespans vary with maintenance, climate, and usage.
        Costs are in today's dollars and do not account for inflation.
      </p>
    </div>
  );
}
