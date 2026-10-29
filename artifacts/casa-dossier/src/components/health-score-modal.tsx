import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { completeMaintenanceTask, createMaintenanceTask } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Hammer, TrendingUp, CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import { getSpecsForCategory } from "@workspace/maintenance-specs";
import type { MaintenanceSpec } from "@workspace/maintenance-specs";
import { invalidateAfterTaskCompletion } from "@/components/maintenance-inbox/invalidate";
import { TaskItem } from "@/components/health-score/task-item";
import { SpecItem } from "@/components/health-score/spec-item";
import { LockedPlanPreview } from "@/components/health-score/locked-preview";
import {
  GRADE_COLORS,
  type AssetScore,
  type CompletePayload,
  type OverdueTask,
} from "@/components/health-score/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  healthScore: number;
  healthGrade: string;
  overdueTaskCount: number;
  overdueTasks?: OverdueTask[];
  assetScores?: AssetScore[];
  propertyId: string;
};

export function HealthScoreModal({
  open,
  onOpenChange,
  healthScore,
  healthGrade,
  overdueTaskCount,
  overdueTasks = [],
  assetScores = [],
  propertyId,
}: Props) {
  const gc = GRADE_COLORS[healthGrade] ?? GRADE_COLORS["C"]!;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const locked = !isBasicPlus(subscription?.tier);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Key = `${assetId}:${spec.title}` for spec completions
  const [completedSpecKeys, setCompletedSpecKeys] = useState<Set<string>>(new Set());

  const remainingOverdue = overdueTaskCount - completedIds.size;
  const pointGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + pointGain, 100);

  async function handleMarkDone(taskId: string, payload: CompletePayload) {
    try {
      await completeMaintenanceTask(taskId, payload);
    } catch {
      toast({ title: t("common.somethingWentWrong"), description: t("healthScore.toast.markDoneFailed"), variant: "destructive" });
      return;
    }

    setCompletedIds((prev) => new Set([...prev, taskId]));
    invalidateAfterTaskCompletion(queryClient, propertyId);

    toast({
      title: t("healthScore.toast.completed"),
      description: payload.notes?.trim() ? t("healthScore.toast.notesSaved") : t("maintenance.toast.nextScheduled"),
    });
  }

  async function handleMarkSpecDone(assetId: string, spec: MaintenanceSpec, payload: CompletePayload) {
    // Step 1: create the task for this asset
    let taskId: string;
    try {
      const task = await createMaintenanceTask(assetId, {
        title: spec.title,
        description: spec.description,
        intervalDays: spec.intervalDays,
        isDiy: spec.isDiy,
        nextDueDate: new Date().toLocaleDateString("en-CA"),
      });
      taskId = task.id;
    } catch {
      toast({ title: t("common.somethingWentWrong"), description: t("healthScore.toast.createFailed"), variant: "destructive" });
      return;
    }

    // Step 2: immediately complete it
    try {
      await completeMaintenanceTask(taskId, payload);
    } catch {
      toast({ title: t("common.somethingWentWrong"), description: t("healthScore.toast.createdNotCompleted"), variant: "destructive" });
      return;
    }

    setCompletedSpecKeys((prev) => new Set([...prev, `${assetId}:${spec.title}`]));
    invalidateAfterTaskCompletion(queryClient, propertyId);

    toast({
      title: t("healthScore.toast.logged"),
      description: t("healthScore.toast.loggedDesc", { title: spec.title, count: spec.intervalDays }),
    });
  }

  const recommendedByAsset = assetScores
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((asset) =>
      getSpecsForCategory(asset.category)
        .filter((s) => s.isDiy)
        .slice(0, 2)
        .map((spec) => ({ spec, asset }))
    )
    .slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">{t("healthScore.title")}</DialogTitle>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${gc.bg} ${gc.text} ${gc.border}`}>
              <TrendingUp className="h-3.5 w-3.5" />
              {t("healthScore.gradeBadge", { grade: healthGrade, score: healthScore })}
            </div>
          </div>

          {overdueTaskCount > 0 && completedIds.size < overdueTaskCount && (
            <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                {t("healthScore.fixRemaining", { count: remainingOverdue })}{" "}
                <span className="font-bold text-primary">{potentialScore}/100</span>
              </p>
            </div>
          )}
          {completedIds.size > 0 && completedIds.size >= overdueTaskCount && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">{t("healthScore.allOverdueDone")}</p>
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
            </div>
          )}
        </DialogHeader>

        {subscriptionLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : locked ? (
          <LockedPlanPreview
            onUpgrade={() => { onOpenChange(false); openUpgradeModal(); }}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-6">

                {/* ── Section 1: Overdue tasks ── */}
                {overdueTaskCount > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarClock className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-semibold">{t("healthScore.fixFirst")}</h3>
                      <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold ml-auto">
                        {t("healthScore.remaining", { count: remainingOverdue })}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {overdueTasks.map((task) => (
                        <TaskItem key={task.id} task={task} done={completedIds.has(task.id)} onMarkDone={handleMarkDone} />
                      ))}
                    </div>
                  </section>
                )}

                {overdueTaskCount > 0 && recommendedByAsset.length > 0 && <Separator />}

                {/* ── Section 2: Manufacturer-spec DIY tasks ── */}
                {recommendedByAsset.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Hammer className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">{t("healthScore.recommendedByManufacturers")}</h3>
                      <Badge variant="secondary" className="text-[10px] font-bold ml-auto">{t("healthScore.diyFirst")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {t("healthScore.specsExplainer")}
                    </p>
                    <div className="space-y-2">
                      {recommendedByAsset.map(({ spec, asset }, i) => (
                        <SpecItem
                          key={`${asset.assetId}-${i}`}
                          spec={spec}
                          assetId={asset.assetId}
                          assetName={asset.assetName}
                          done={completedSpecKeys.has(`${asset.assetId}:${spec.title}`)}
                          onMarkDone={handleMarkSpecDone}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {overdueTaskCount === 0 && recommendedByAsset.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-70" />
                    <p className="font-semibold">{t("healthScore.greatShape")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("healthScore.noActionNeeded")}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* ── Footer ── */}
            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/30">
              <p className="text-xs text-muted-foreground leading-snug">
                {t("healthScore.footer")}
              </p>
              <Button size="sm" onClick={() => onOpenChange(false)} variant="outline">{t("common.close")}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
