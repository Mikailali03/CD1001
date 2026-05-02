import { useState } from "react";
import { useGetPropertySummary } from "@workspace/api-client-react";
import { useProperty } from "@/contexts/property-context";
import { HealthScoreModal } from "@/components/health-score-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MapPin,
  ArrowRight,
  Building2,
  Plus,
  TrendingUp,
  ChevronRight,
  Hammer,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

// ── Grade config ──────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", bg: "#3d7a5f12", ringFg: "#3d7a5f", label: "Excellent",  cta: "Your home is in great shape!" },
  B: { color: "#4b7fb5", bg: "#4b7fb512", ringFg: "#4b7fb5", label: "Good",       cta: "A few quick tasks will get you to A." },
  C: { color: "#c8853a", bg: "#c8853a12", ringFg: "#c8853a", label: "Fair",       cta: "Several items need attention." },
  D: { color: "#b85a2a", bg: "#b85a2a12", ringFg: "#b85a2a", label: "Poor",       cta: "Significant backlog detected." },
  F: { color: "#c0392b", bg: "#c0392b0e", ringFg: "#c0392b", label: "Critical",   cta: "Immediate action recommended." },
} as const;

// ── Compact score widget (clickable CTA) ──────────────────────────────────────
function HealthScoreWidget({
  score,
  grade,
  overdueCount,
  onClick,
}: {
  score: number;
  grade: keyof typeof GRADE_CONFIG;
  overdueCount: number;
  onClick: () => void;
}) {
  const cfg = GRADE_CONFIG[grade];
  const radius = 26;
  const stroke = 5;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border-2 bg-card px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
      style={{ borderColor: cfg.color + "44" }}
    >
      {/* mini ring */}
      <div className="relative shrink-0">
        <svg width={66} height={66} className="-rotate-90">
          <circle cx={33} cy={33} r={radius} fill="none" stroke={cfg.bg} strokeWidth={stroke} />
          <circle
            cx={33} cy={33} r={radius} fill="none"
            stroke={cfg.ringFg} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-lg font-black tabular-nums" style={{ color: cfg.color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: cfg.color }}>Grade {grade}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{cfg.cta}</p>
        {overdueCount > 0 && (
          <p className="text-xs font-semibold mt-1.5 flex items-center gap-1" style={{ color: cfg.color }}>
            <TrendingUp className="h-3 w-3" />
            See improvement plan
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-[74px] w-72 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
  const [modalOpen, setModalOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    activePropertyId ?? "",
    { query: { enabled: !!activePropertyId } }
  );

  const isLoading = propLoading || (!!activePropertyId && summaryLoading);

  if (isLoading) return <DashboardSkeleton />;
  if (!activePropertyId || !activeProperty) return <NoPropertyState />;
  if (!summary) return <DashboardSkeleton />;

  const grade = (summary.healthGrade ?? "C") as keyof typeof GRADE_CONFIG;
  const recentRecords = (summary as any).recentRecords ?? [];
  const assetScores: any[] = (summary as any).assetScores ?? [];
  const overdueTasksList: any[] = (summary as any).overdueTasks ?? [];
  const location = [activeProperty.city, activeProperty.state].filter(Boolean).join(", ");

  // All pending tasks = overdue + upcoming combined for the maintenance card
  const allTasks = [...overdueTasksList, ...(summary.upcomingTasks ?? [])];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Property header + score widget ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{activeProperty.name}</h1>
            <Link href={`/properties/${activePropertyId}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground h-7 px-2">
                <span className="text-xs">View</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
        </div>

        {/* Clickable health score — always visible in header area */}
        <HealthScoreWidget
          score={summary.healthScore}
          grade={grade}
          overdueCount={summary.overdueTaskCount ?? 0}
          onClick={() => setModalOpen(true)}
        />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tracked Assets</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-semibold">{summary.verifiedAssets}</span> of {summary.totalAssets} verified
            </p>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-sm transition-shadow ${(summary.overdueTaskCount ?? 0) > 0 ? "border-destructive/30" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : ""}`}>
              {summary.overdueTaskCount}
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-primary underline-offset-2 hover:underline mt-1 flex items-center gap-0.5"
            >
              {(summary.overdueTaskCount ?? 0) > 0 ? "See what to fix →" : "All clear"}
            </button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assets by System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {summary.assetsByCategory?.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1 bg-secondary rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {cat.category} <span className="text-muted-foreground">· {cat.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: upcoming tasks + recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Upcoming maintenance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Upcoming Maintenance</CardTitle>
                <CardDescription>Scheduled tasks for your assets</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setModalOpen(true)}>
                <Hammer className="h-3.5 w-3.5" />
                DIY Guides
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {allTasks.length > 0 ? (
              <div className="divide-y">
                {allTasks.slice(0, 6).map((task: any) => {
                  const daysAway = task.nextDueDate
                    ? Math.ceil((new Date(task.nextDueDate).getTime() - Date.now()) / 86_400_000)
                    : null;
                  const isOverdue = daysAway !== null && daysAway < 0;

                  return (
                    <div key={task.id} className="py-3 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                        <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(task.nextDueDate), "MMM d, yyyy")}</span>
                          {isOverdue && <span className="font-semibold">· {Math.abs(daysAway!)}d overdue</span>}
                          {!isOverdue && daysAway !== null && daysAway <= 14 && (
                            <span className="text-amber-600 font-medium">· in {daysAway}d</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOverdue && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        {task.isDiy && (
                          <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
                            <Hammer className="h-2.5 w-2.5" />
                            DIY
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-60" />
                <p className="text-sm font-medium">All caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent service activity */}
        <Card>
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

      {/* ── Health score modal ── */}
      <HealthScoreModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        healthScore={summary.healthScore}
        healthGrade={summary.healthGrade ?? "C"}
        overdueTaskCount={summary.overdueTaskCount ?? 0}
        overdueTasks={overdueTasksList}
        assetScores={assetScores}
      />
    </div>
  );
}
