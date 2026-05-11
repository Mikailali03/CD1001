import { useGetPropertySummary, getGetPropertySummaryQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  Wrench,
} from "lucide-react";

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
  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId), enabled: open },
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
            {propertyName} — Health Report
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
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

const RING_RADIUS = 18;
const RING_STROKE = 3.5;
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
        {/* Score label */}
        <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="8.5"
          fontWeight="700"
          fill={color}
          style={{ fontFamily: "inherit" }}
        >
          {healthScore}
        </text>
        {/* Grade label */}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="6"
          fontWeight="600"
          fill={color}
          opacity="0.75"
          style={{ fontFamily: "inherit" }}
        >
          {healthGrade}
        </text>
      </svg>
    </button>
  );
}
