import { useGetPropertySummary, getGetPropertySummaryQueryKey } from "@workspace/api-client-react";
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
  Clock,
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
// Inline badge — used on the property card
// ------------------------------------------------------------------

interface HealthScoreBadgeProps {
  propertyId: string;
  onClick: (e: React.MouseEvent) => void;
}

export function HealthScoreBadge({ propertyId, onClick }: HealthScoreBadgeProps) {
  const { data: summary, isLoading } = useGetPropertySummary(propertyId);

  if (isLoading) {
    return <Skeleton className="h-6 w-16 rounded-full" />;
  }

  if (!summary) return null;

  const { healthScore, healthGrade } = summary;

  const bg =
    healthScore >= 90 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200"
    : healthScore >= 75 ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
    : healthScore >= 60 ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
    : healthScore >= 45 ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
    : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${bg}`}
    >
      <Clock className="h-3 w-3" />
      {healthScore} · {healthGrade}
    </button>
  );
}
