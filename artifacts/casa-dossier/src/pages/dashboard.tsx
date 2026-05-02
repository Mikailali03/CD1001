import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  Home,
  Wrench,
  FileText,
  AlertCircle,
  Clock,
  TrendingDown,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { Link } from "wouter";

// ── Score ring ────────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", trackColor: "#3d7a5f26", label: "Excellent", tip: "Your home is in great shape. Keep up the maintenance schedule." },
  B: { color: "#4b7fb5", trackColor: "#4b7fb526", label: "Good",      tip: "A few items need attention to reach excellent status." },
  C: { color: "#c8853a", trackColor: "#c8853a26", label: "Fair",      tip: "Several assets are aging or tasks are overdue. Address soon." },
  D: { color: "#b85a2a", trackColor: "#b85a2a26", label: "Poor",      tip: "Significant maintenance backlog or aging systems detected." },
  F: { color: "#c0392b", trackColor: "#c0392b1a", label: "Critical",  tip: "Immediate attention required — multiple critical issues." },
} as const;

function ScoreRing({ score, grade }: { score: number; grade: keyof typeof GRADE_CONFIG }) {
  const cfg = GRADE_CONFIG[grade];
  const radius = 72;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={180} height={180} className="-rotate-90">
        {/* Track */}
        <circle cx={90} cy={90} r={radius} fill="none" stroke={cfg.trackColor} strokeWidth={stroke} />
        {/* Progress */}
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke={cfg.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-4xl font-black" style={{ color: cfg.color }}>{score}</span>
        <span className="text-[11px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-widest">/ 100</span>
        <span
          className="mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: cfg.trackColor, color: cfg.color }}
        >
          Grade {grade}
        </span>
      </div>
    </div>
  );
}

// ── Asset age bar ────────────────────────────────────────────────────────────
function AssetAgeBar({
  assetName,
  category,
  score,
  ageYears,
  lifespanYears,
}: {
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
}) {
  const pct = Math.min(100, Math.round((ageYears / lifespanYears) * 100));
  const barColor =
    score >= 70 ? "bg-chart-1"
    : score >= 40 ? "bg-chart-3"
    : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium truncate max-w-[160px]">{assetName}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{ageYears}yr / {lifespanYears}yr</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
        <Skeleton className="h-9 w-52" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-1" />
          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-7">
          <Skeleton className="h-80 rounded-xl lg:col-span-4" />
          <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const grade = (dashboard.homeHealthGrade ?? "C") as keyof typeof GRADE_CONFIG;
  const cfg = GRADE_CONFIG[grade];
  const breakdown = dashboard.scoringBreakdown;

  const overdueItems = dashboard.upcomingTasks?.filter(
    (t) => t.nextDueDate && isPast(parseISO(t.nextDueDate))
  ) ?? [];
  const upcomingItems = dashboard.upcomingTasks?.filter(
    (t) => !t.nextDueDate || !isPast(parseISO(t.nextDueDate))
  ) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your home's live health score and maintenance overview.</p>
      </div>

      {/* ── Row 1: Score hero + stats ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Health Score Card */}
        <Card className="lg:col-span-1 flex flex-col items-center justify-center py-8 px-6 text-center gap-4 hover-elevate transition-shadow border-2" style={{ borderColor: cfg.color + "33" }}>
          <ScoreRing score={dashboard.homeHealthScore} grade={grade} />
          <div className="space-y-1">
            <p className="font-semibold text-base text-foreground">{cfg.label} Condition</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">{cfg.tip}</p>
          </div>
          {breakdown && (
            <div className="w-full space-y-3 border-t pt-4 text-left">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Asset age</span>
                  <span className="font-semibold">{breakdown.assetAgeScore}/100</span>
                </div>
                <Progress value={breakdown.assetAgeScore} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Maintenance</span>
                  <span className="font-semibold">{breakdown.overdueScore}/100</span>
                </div>
                <Progress value={breakdown.overdueScore} className="h-1.5" />
              </div>
            </div>
          )}
        </Card>

        {/* Stat mini-cards */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <Card className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Properties</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.totalProperties}</div>
              <p className="text-xs text-muted-foreground mt-1">In your dossier</p>
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
                <span className="text-chart-1 font-medium">{dashboard.verifiedAssets}</span> verified
              </p>
            </CardContent>
          </Card>

          <Card className={`hover-elevate transition-shadow ${(dashboard.overdueTaskCount ?? 0) > 0 ? "border-destructive/30" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className={`h-4 w-4 ${(dashboard.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(dashboard.overdueTaskCount ?? 0) > 0 ? "text-destructive" : ""}`}>
                {dashboard.overdueTaskCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(dashboard.overdueTaskCount ?? 0) === 0 ? "All clear" : `Drag score −${Math.min((dashboard.overdueTaskCount ?? 0) * 15, 100)} pts`}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
              <Clock className="h-4 w-4 text-chart-3" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.dueSoonTaskCount ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Next 30 days</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Row 2: Critical assets + upcoming tasks + activity ── */}
      <div className="grid gap-4 lg:grid-cols-7">

        {/* Left: critical + asset age breakdown */}
        <div className="lg:col-span-3 space-y-4">

          {/* Critical assets near end of life */}
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
                  <AssetAgeBar
                    key={a.assetId}
                    assetName={a.assetName}
                    category={a.category}
                    score={a.score}
                    ageYears={a.ageYears}
                    lifespanYears={a.lifespanYears}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Asset age breakdown for all assets */}
          {breakdown?.criticalAssets !== undefined && (
            <Card className="hover-elevate transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Asset Age Breakdown</CardTitle>
                <CardDescription>Age vs. expected lifespan by system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.assetHealthByCategory?.map((cat) => {
                  const lifespan = { HVAC: 15, Plumbing: 30, Electrical: 25, Roof: 20, Appliance: 10, Structural: 50, Other: 15 }[cat.category] ?? 15;
                  return (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{cat.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">~{lifespan}yr lifespan</span>
                        <Badge variant="secondary" className="text-xs">{cat.total} asset{cat.total > 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: upcoming tasks + recent activity */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="hover-elevate transition-shadow">
            <CardHeader>
              <CardTitle>Upcoming Maintenance</CardTitle>
              <CardDescription>Tasks scheduled for your assets</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingItems.length > 0 ? (
                <div className="divide-y">
                  {upcomingItems.slice(0, 6).map((task) => {
                    const daysAway = task.nextDueDate
                      ? Math.ceil((new Date(task.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    return (
                      <div key={task.id} className="py-3 flex items-start justify-between gap-3 last:pb-0 first:pt-0">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(task.nextDueDate), "MMM d, yyyy")}</span>
                            {daysAway !== null && daysAway <= 14 && (
                              <span className="text-chart-3 font-medium">· {daysAway}d away</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {task.isDiy && <Badge variant="secondary" className="text-[10px]">DIY</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-chart-1 mb-2 opacity-60" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-1">No upcoming maintenance tasks.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-shadow">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest service records across all properties</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.recentRecords && dashboard.recentRecords.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.recentRecords.slice(0, 4).map((record) => (
                    <div key={record.id} className="flex items-start gap-3">
                      <div className="mt-0.5 bg-secondary p-1.5 rounded-full shrink-0">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-medium leading-tight line-clamp-2">{record.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.technicianName || record.companyName || "Service"} · {format(new Date(record.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
