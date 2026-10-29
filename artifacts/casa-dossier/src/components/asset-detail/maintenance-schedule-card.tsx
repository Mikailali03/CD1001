import { useTranslation } from "react-i18next";
import type { MaintenanceTask } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Wrench } from "lucide-react";
import { MarkCompleteForm } from "./mark-complete-form";
import { CompletedTaskRow } from "./completed-task-row";
import { AddTaskInlineForm } from "./add-task-inline-form";

// ── Maintenance Schedule ──────────────────────────────────────────────────────
export function MaintenanceScheduleCard({ pendingTasks, completedTasks, assetId, propertyId, onDismissTask }: {
  pendingTasks: MaintenanceTask[];
  completedTasks: MaintenanceTask[];
  assetId: string;
  propertyId: string;
  onDismissTask: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            {t("assetDetail.schedule.title")}
          </CardTitle>
          {pendingTasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {t("assetDetail.schedule.taskCount", { count: pendingTasks.length })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-60" />
            <p className="text-sm font-medium">{t("assetDetail.schedule.allCaughtUp")}</p>
            <p className="text-xs text-center max-w-[180px] text-muted-foreground">{t("assetDetail.schedule.noPending")}</p>
          </div>
        ) : (
          pendingTasks.map((task) => (
            <MarkCompleteForm
              key={task.id}
              task={task}
              assetId={assetId}
              propertyId={propertyId}
              onDismiss={() => onDismissTask(task.id)}
            />
          ))
        )}

        {completedTasks.length > 0 && (
          <div className="pt-2 space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {t("assetDetail.schedule.completedCount", { count: completedTasks.length })}
            </p>
            {completedTasks.slice(0, 3).map((task) => (
              <CompletedTaskRow key={task.id} task={task} assetId={assetId} />
            ))}
          </div>
        )}

        <AddTaskInlineForm
          assetId={assetId}
          onSuccess={() => {}}
        />
      </CardContent>
    </Card>
  );
}
