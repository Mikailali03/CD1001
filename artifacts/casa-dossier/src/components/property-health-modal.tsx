import { useTranslation } from "react-i18next";
import {
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
  type MaintenanceTask,
  type ServiceRecord,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { format } from "@/lib/date";
import { PropertyPlanLocked } from "@/components/health-score/property-plan-locked";

// The badge lives in its own file; re-exported so existing imports keep working.
export { HealthScoreBadge } from "@/components/health-score/health-score-badge";

type WithAssetName = { assetName?: string };

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
  return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
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

// Reuses the dashboard grade labels.
function scoreLabelKey(score: number): string {
  if (score >= 90) return "dashboard.gradeExcellent";
  if (score >= 75) return "dashboard.gradeGood";
  if (score >= 60) return "dashboard.gradeFair";
  if (score >= 45) return "dashboard.gradePoor";
  return "dashboard.gradeCritical";
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
  const { t } = useTranslation();
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const locked = !subscriptionLoading && !isBasicPlus(subscription?.tier);

  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId), enabled: open && !subscriptionLoading && !locked },
  });

  const today = new Date();
  const todayStr = toISODate(today);
  const in30Days = toISODate(addDays(today, 30));
  const ago60Days = toISODate(addDays(today, -60));

  // Tasks due in the next 30 days (not overdue)
  // The summary route adds `assetName` to tasks and records, and returns
  // `overdueTasks`, none of which the OpenAPI spec describes yet.
  const extras = summary as
    | (Omit<NonNullable<typeof summary>, "upcomingTasks" | "recentRecords"> & {
        upcomingTasks: (MaintenanceTask & WithAssetName)[];
        recentRecords?: (ServiceRecord & WithAssetName)[];
        overdueTasks?: (MaintenanceTask & WithAssetName)[];
      })
    | undefined;

  const next30Tasks = (extras?.upcomingTasks ?? []).filter(
    (task) => task.nextDueDate >= todayStr && task.nextDueDate <= in30Days,
  );

  // Overdue tasks also surface in the 30-day section
  const overdueTasks = extras?.overdueTasks ?? [];

  // Assets below 75%
  const lowAssets = (summary?.assetScores ?? [])
    .filter((s) => s.score < 75)
    .sort((a, b) => a.score - b.score);

  // Recent service records within 60 days
  const recentRecords = (extras?.recentRecords ?? []).filter(
    (r) => r.date >= ago60Days,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-tight">
            {t("propertyHealth.title", { name: propertyName })}
          </DialogTitle>
        </DialogHeader>

        {locked ? (
          <PropertyPlanLocked onUpgrade={() => { onClose(); openUpgradeModal(); }} onClose={onClose} />
        ) : subscriptionLoading || isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("propertyHealth.loadFailed")}
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
                  {t("propertyHealth.scoreLabel", { label: t(scoreLabelKey(summary.healthScore)), grade: summary.healthGrade })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("propertyHealth.assetsTracked", { count: summary.totalAssets })}
                  {summary.overdueTaskCount > 0 && (
                    <> · <span className="text-red-600 font-medium">{t("propertyHealth.overdueCount", { count: summary.overdueTaskCount })}</span></>
                  )}
                </p>
              </div>
            </div>

            {/* --- Assets below 75% --- */}
            <div>
              <SectionHeader
                icon={ShieldAlert}
                label={t("propertyHealth.assetsNeedingAttention")}
                count={lowAssets.length}
              />
              {lowAssets.length === 0 ? (
                <EmptyNote>{t("propertyHealth.allAssetsHealthy")}</EmptyNote>
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
                            {t(`assets.category.${asset.category}`, { defaultValue: asset.category })} · {t("propertyHealth.ageOfLifespan", { age: asset.ageYears, lifespan: asset.lifespanYears })}
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
                          <span className="text-xs font-medium">{t("propertyHealth.planReplacement")}</span>
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
                label={t("propertyHealth.next30Days")}
                count={overdueTasks.length + next30Tasks.length}
              />
              {overdueTasks.length === 0 && next30Tasks.length === 0 ? (
                <EmptyNote>{t("propertyHealth.nothingDue")}</EmptyNote>
              ) : (
                <div className="space-y-1.5">
                  {overdueTasks.map((task) => (
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
                        {t("propertyHealth.overdue")}
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
                        {task.assetName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.assetName}</p>
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
                label={t("propertyHealth.recentlyCompleted")}
                count={recentRecords.length}
              />
              {recentRecords.length === 0 ? (
                <EmptyNote>{t("propertyHealth.noRecent")}</EmptyNote>
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
                        {record.assetName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {record.assetName}
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
