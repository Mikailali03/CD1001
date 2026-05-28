import { useGetPropertySummary, getGetPropertySummaryQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  Lock,
  Sparkles,
  TrendingUp,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import homeHeroBadge from "@assets/home_hero_badge_1779979811101.png";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function scoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-50 border-emerald-200";
  if (score >= 75) return "bg-blue-50 border-blue-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  if (score >= 45) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function scoreText(score: number): string {
  if (score >= 90) return "text-emerald-700";
  if (score >= 75) return "text-blue-700";
  if (score >= 60) return "text-amber-700";
  if (score >= 45) return "text-orange-700";
  return "text-red-700";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 45) return "Poor";
  return "Critical";
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {count !== undefined && (
        <Badge variant="secondary" className="ml-auto text-xs font-medium">
          {count}
        </Badge>
      )}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground italic py-2 pl-1">{children}</p>
  );
}

// ------------------------------------------------------------------
// Main modal
// ------------------------------------------------------------------

interface PropertyHealthModalProps {
  propertyId: string;
  propertyName: string;
  open: boolean;
  onClose: () => void;
}

export function PropertyHealthModal({
  propertyId,
  propertyName,
  open,
  onClose,
}: PropertyHealthModalProps) {
  const { subscription, openUpgradeModal } = useSubscription();
  const locked = !isBasicPlus(subscription?.tier);

  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId), enabled: open && !locked },
  });

  const today = new Date();
  const todayStr = toISODate(today);
  const in30Days = toISODate(addDays(today, 30));
  const ago60Days = toISODate(addDays(today, -60));

  // Tasks due in the next 30 days (not overdue)
  const next30Tasks = (summary?.upcomingTasks ?? []).filter(
    (t) => t.nextDueDate >= todayStr && t.nextDueDate <= in30Days,
  );

  // Overdue tasks also surface in the 30-day section
  const overdueTasks = (summary as any)?.overdueTasks ?? [];

  // Assets below 75%
  const lowAssets = (summary?.assetScores ?? [])
    .filter((s) => s.score < 75)
    .sort((a, b) => a.score - b.score);

  // Recent service records within 60 days
  const recentRecords = (summary?.recentRecords ?? []).filter(
    (r) => r.date >= ago60Days,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-tight">
            {propertyName} — Home Improvement Plan
          </DialogTitle>
        </DialogHeader>

        {locked ? (
          <div className="relative">
            {/* Blurred fake content underneath */}
            <div className="blur-sm pointer-events-none select-none space-y-6 pt-1 opacity-60" aria-hidden>
              <div className={`flex items-center gap-4 rounded-xl border p-4 bg-blue-50 border-blue-200`}>
                <div className="text-center min-w-[56px]">
                  <p className="text-3xl font-bold leading-none text-blue-700">82</p>
                  <p className="text-xs font-medium mt-0.5 text-blue-700">/ 100</p>
                </div>
                <div>
                  <p className="font-semibold text-sm text-blue-700">Good (B)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">4 assets tracked · 2 overdue</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Assets Needing Attention</span>
                  <Badge variant="secondary" className="ml-auto text-xs">2</Badge>
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-lg border p-3 bg-amber-50 border-amber-200 h-14" />
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Maintenance in the Next 30 Days</span>
                  <Badge variant="secondary" className="ml-auto text-xs">3</Badge>
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg border bg-muted/40" />
                ))}
              </div>
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-6 w-full max-w-sm text-center space-y-4">
                <div className="flex justify-center">
                  <div className="bg-primary/10 rounded-full p-4">
                    <Lock className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold">Unlock Your Home Improvement Plan</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get a full picture of your home's health — asset condition scores, upcoming maintenance, recently completed work, and a prioritized action plan — all in one place.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">Asset health scores</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">30-day task plan</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">Investment tracking</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => { onClose(); openUpgradeModal(); }}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Upgrade to Basic — $9.99/mo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
                    Maybe later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to load property data.
          </p>
        ) : (
          <div className="space-y-6 pt-1">
            {/* Overall score */}
            <div
              className={`flex items-center gap-4 rounded-xl border p-4 ${scoreBg(summary.healthScore)}`}
            >
              <div className="text-center min-w-[56px]">
                <p className={`text-3xl font-bold leading-none ${scoreText(summary.healthScore)}`}>
                  {summary.healthScore}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${scoreText(summary.healthScore)}`}>
                  / 100
                </p>
              </div>
              <div>
                <p className={`font-semibold text-sm ${scoreText(summary.healthScore)}`}>
                  {scoreLabel(summary.healthScore)} ({summary.healthGrade})
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.totalAssets} asset{summary.totalAssets !== 1 ? "s" : ""} tracked
                  {summary.overdueTaskCount > 0 && (
                    <> · <span className="text-red-600 font-medium">{summary.overdueTaskCount} overdue</span></>
                  )}
                </p>
              </div>
            </div>

            {/* --- Assets below 75% --- */}
            <div>
              <SectionHeader
                icon={ShieldAlert}
                label="Assets Needing Attention"
                count={lowAssets.length}
              />
              {lowAssets.length === 0 ? (
                <EmptyNote>All assets are at 75% or above — great shape!</EmptyNote>
              ) : (
                <div className="space-y-2">
                  {lowAssets.map((asset) => (
                    <div
                      key={asset.assetId}
                      className={`rounded-lg border p-3 ${scoreBg(asset.score)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{asset.assetName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {asset.category} · {asset.ageYears}y old of {asset.lifespanYears}y lifespan
                          </p>
                        </div>
                        <div className={`text-right shrink-0`}>
                          <span className={`text-lg font-bold ${scoreText(asset.score)}`}>
                            {asset.score}%
                          </span>
                        </div>
                      </div>
                      {asset.score < 40 && (
                        <div className="flex items-center gap-1.5 mt-2 text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs font-medium">Plan for replacement soon</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Maintenance in next 30 days --- */}
            <div>
              <SectionHeader
                icon={CalendarClock}
                label="Maintenance in the Next 30 Days"
                count={overdueTasks.length + next30Tasks.length}
              />
              {overdueTasks.length === 0 && next30Tasks.length === 0 ? (
                <EmptyNote>Nothing due in the next 30 days.</EmptyNote>
              ) : (
                <div className="space-y-1.5">
                  {overdueTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
                        {task.assetName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.assetName}</p>
                        )}
                      </div>
                      <span className="text-xs text-red-600 font-medium shrink-0 mt-0.5">
                        Overdue
                      </span>
                    </div>
                  ))}
                  {next30Tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5"
                    >
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
                        {(task as any).assetName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{(task as any).assetName}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {formatDate(task.nextDueDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Recently completed maintenance --- */}
            <div>
              <SectionHeader
                icon={CheckCircle2}
                label="Recently Completed (last 60 days)"
                count={recentRecords.length}
              />
              {recentRecords.length === 0 ? (
                <EmptyNote>No maintenance logged in the past 60 days.</EmptyNote>
              ) : (
                <div className="space-y-1.5">
                  {recentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-start gap-3 rounded-lg border bg-emerald-50 border-emerald-200 px-3 py-2.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {record.description}
                        </p>
                        {(record as any).assetName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(record as any).assetName}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{formatDate(record.date)}</span>
                        {record.cost != null && (
                          <p className="text-xs text-emerald-700 font-medium mt-0.5">
                            ${record.cost.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Circular progress ring — used on the property card
// ------------------------------------------------------------------

const RING_RADIUS = 36;
const RING_STROKE = 7;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981"; // emerald
  if (score >= 75) return "#3b82f6"; // blue
  if (score >= 60) return "#f59e0b"; // amber
  if (score >= 45) return "#f97316"; // orange
  return "#ef4444";                  // red
}

interface HealthScoreBadgeProps {
  propertyId: string;
  onClick: (e: React.MouseEvent) => void;
}

export function HealthScoreBadge({ propertyId, onClick }: HealthScoreBadgeProps) {
  const { data: summary, isLoading } = useGetPropertySummary(propertyId);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (summary?.healthScore == null) return;
    // Defer one frame so the transition is visible even when data is cached
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setAnimatedScore(summary.healthScore), 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [summary?.healthScore]);

  if (isLoading) {
    return <Skeleton className="rounded-full shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }} />;
  }

  if (!summary) return null;

  const { healthScore, healthGrade } = summary;
  const color = scoreColor(healthScore);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const filled = RING_CIRCUMFERENCE * (animatedScore / 100);
  const offset = RING_CIRCUMFERENCE - filled;

  return (
    <button
      onClick={onClick}
      title={`Health score: ${healthScore}/100 (${healthGrade})`}
      className="shrink-0 rounded-full cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-label={`Health score ${healthScore}`}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={RING_STROKE}
        />
        {/* Progress arc — starts at top (-90°) */}
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
        {/* Score / badge label */}
        {healthScore >= 100 ? (
          <image
            href={homeHeroBadge}
            x={cx - 28}
            y={cy - 28}
            width={56}
            height={56}
          />
        ) : (
          <>
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="17"
              fontWeight="700"
              fill={color}
              style={{ fontFamily: "inherit" }}
            >
              {healthScore}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="600"
              fill={color}
              opacity="0.75"
              style={{ fontFamily: "inherit" }}
            >
              {healthGrade}
            </text>
          </>
        )}
      </svg>
    </button>
  );
}
