import { useGetPropertySummary, useGetProperty } from "@workspace/api-client-react";
import { useProperty } from "@/contexts/property-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Wrench,
  FileText,
  AlertCircle,
  TrendingDown,
  CheckCircle2,
  Calendar,
  MapPin,
  ArrowRight,
  Building2,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

// ── Score ring ────────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", trackColor: "#3d7a5f26", label: "Excellent",   tip: "Your home is in great shape. Keep up the maintenance schedule." },
  B: { color: "#4b7fb5", trackColor: "#4b7fb526", label: "Good",        tip: "A few items need attention to reach excellent status." },
  C: { color: "#c8853a", trackColor: "#c8853a26", label: "Fair",        tip: "Several assets are aging or tasks are overdue. Address soon." },
  D: { color: "#b85a2a", trackColor: "#b85a2a26", label: "Poor",        tip: "Significant maintenance backlog or aging systems detected." },
  F: { color: "#c0392b", trackColor: "#c0392b1a", label: "Critical",    tip: "Immediate attention required — multiple critical issues." },
} as const;

function ScoreRing({ score, grade }: { score: number; grade: keyof typeof GRADE_CONFIG }) {
  const cfg = GRADE_CONFIG[grade];
  const radius = 64;
  const stroke = 9;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={160} height={160} className="-rotate-90">
        <circle cx={80} cy={80} r={radius} fill="none" stroke={cfg.trackColor} strokeWidth={stroke} />
        <circle
          cx={80} cy={80} r={radius} fill="none"
          stroke={cfg.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-4xl font-black tabular-nums" style={{ color: cfg.color }}>{score}</span>
        <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">out of 100</span>
        <span className="mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.trackColor, color: cfg.color }}>
          Grade {grade}
        </span>
      </div>
    </div>
  );
}

function AssetAgeBar({ assetName, score, ageYears, lifespanYears }: {
  assetName: string; score: number; ageYears: number; lifespanYears: number;
}) {
  const pct = Math.min(100, Math.round((ageYears / lifespanYears) * 100));
  const barColor = score >= 70 ? "bg-chart-1" : score >= 40 ? "bg-chart-3" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium truncate max-w-[160px]">{assetName}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{ageYears}yr / {lifespanYears}yr</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function NoPropertyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="bg-secondary rounded-2xl p-6 mb-6">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No property selected</h2>
      <p className="text-muted-foreground max-w-sm mb-6 text-sm">
        Add your home to start tracking its health score, assets, and maintenance schedule.
      </p>
      <Link href="/properties">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Your Home
        </Button>
      </Link>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl" />
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { activePropertyId, activeProperty, isLoading: propLoading } = useProperty();

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    activePropertyId ?? "",
    { query: { enabled: !!activePropertyId, queryKey: ["property-summary", activePropertyId] } }
  );

  const isLoading = propLoading || (!!activePropertyId && summaryLoading);

  if (isLoading) return <DashboardSkeleton />;
  if (!activePropertyId || !activeProperty) return <NoPropertyState />;
  if (!summary) return <DashboardSkeleton />;

  const grade = (summary.healthGrade ?? "C") as keyof typeof GRADE_CONFIG;
  const cfg = GRADE_CONFIG[grade];
  const breakdown = summary.scoringBreakdown;
  const recentRecords = (summary as any).recentRecords ?? [];
  const location = [activeProperty.city, activeProperty.state].filter(Boolean).join(", ");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Property header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{activeProperty.name}</h1>
          {location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
        </div>
        <Link href={`/properties/${activePropertyId}`}>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            View Property
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Row 1: Score hero + stat cards */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Health score card */}
        <Card className="lg:col-span-1 flex flex-col items-center justify-center py-7 px-6 text-center gap-4 hover-elevate transition-shadow border-2" style={{ borderColor: cfg.color + "33" }}>
          <ScoreRing score={summary.healthScore} grade={grade} />
          <div className="space-y-1">
            <p className="font-semibold text-base">{cfg.label} Condition</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">{cfg.tip}</p>
          </div>
          {breakdown && (
            <div className="w-full space-y-3 border-t pt-4 text-left">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Asset age score</span>
                  <span className="font-semibold">{breakdown.assetAgeScore}/100</span>
                </div>
                <Progress value={breakdown.assetAgeScore ?? 0} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Maintenance score</span>
                  <span className="font-semibold">{breakdown.overdueScore}/100</span>
                </div>
                <Progress value={breakdown.overdueScore ?? 0} className="h-1.5" />
              </div>
            </div>
          )}
        </Card>

        {/* Stat mini-cards */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <Card className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tracked Assets</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAssets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-chart-1 font-medium">{summary.verifiedAssets}</span> of {summary.totalAssets} verified
              </p>
            </CardContent>
          </Card>

          <Card className={`hover-elevate transition-shadow ${(summary.overdueTaskCount ?? 0) > 0 ? "border-destructive/30" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className={`h-4 w-4 ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : ""}`}>
                {summary.overdueTaskCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(summary.overdueTaskCount ?? 0) === 0
                  ? "All clear"
                  : `−${Math.min((summary.overdueTaskCount ?? 0) * 15, 100)} pts from score`}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-shadow sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Assets by System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.assetsByCategory?.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1 text-xs font-medium">
                    <span>{cat.category}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-bold">{cat.count}</span>
                  </div>
                ))}
                {(!summary.assetsByCategory || summary.assetsByCategory.length === 0) && (
                  <p className="text-xs text-muted-foreground">No assets tracked yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Critical alerts + maintenance + activity */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Left: near end of life + upcoming tasks */}
        <div className="space-y-4">
          {breakdown?.criticalAssets && breakdown.criticalAssets.length > 0 && (
            <Card className="border-destructive/30 hover-elevate transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-sm font-semibold text-destructive">Nearing End of Life</CardTitle>
                </div>
                <CardDescription>These assets are dragging your score down the most.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {breakdown.criticalAssets.map((a) => (
                  <AssetAgeBar key={a.assetId} assetName={a.assetName} score={a.score} ageYears={a.ageYears} lifespanYears={a.lifespanYears} />
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="hover-elevate transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Upcoming Maintenance</CardTitle>
              <CardDescription>Scheduled tasks for your assets</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.upcomingTasks && summary.upcomingTasks.length > 0 ? (
                <div className="divide-y">
                  {summary.upcomingTasks.slice(0, 5).map((task) => {
                    const daysAway = task.nextDueDate
                      ? Math.ceil((new Date(task.nextDueDate).getTime() - Date.now()) / 86_400_000)
                      : null;
                    return (
                      <div key={task.id} className="py-3 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(task.nextDueDate), "MMM d, yyyy")}</span>
                            {daysAway !== null && daysAway <= 14 && (
                              <span className="text-chart-3 font-medium">· {daysAway}d</span>
                            )}
                          </div>
                        </div>
                        {task.isDiy && <Badge variant="secondary" className="text-[10px] shrink-0">DIY</Badge>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-chart-1 mb-2 opacity-60" />
                  <p className="text-sm font-medium">All caught up!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: recent service activity */}
        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle>Recent Service Activity</CardTitle>
            <CardDescription>Latest work done on this property</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRecords.length > 0 ? (
              <div className="space-y-5">
                {recentRecords.slice(0, 6).map((record: any) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-secondary p-1.5 rounded-full shrink-0">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{record.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.assetName && <span className="font-medium">{record.assetName} · </span>}
                        {record.technicianName || record.companyName || "Service"}
                        {" · "}
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No service records yet</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Service history will appear here as you log work done on your home's systems.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
