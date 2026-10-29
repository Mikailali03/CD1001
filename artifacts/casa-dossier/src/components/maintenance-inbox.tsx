import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useListAssets,
  useGetPropertyMaintenanceInbox,
  completeMaintenanceTask,
  updateMaintenanceTask,
  deleteMaintenanceTask,
  createMaintenanceTask,
  getListAssetsQueryKey,
  getGetPropertySummaryQueryKey,
  getGetPropertyMaintenanceInboxQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Clock, X, Wrench, Plus } from "lucide-react";
import { TaskRow } from "@/components/maintenance-inbox/task-row";
import { NewTaskForm } from "@/components/maintenance-inbox/new-task-form";
import { invalidateAfterTaskCompletion } from "@/components/maintenance-inbox/invalidate";
import type { CompletePayload, TaskFormPayload } from "@/components/maintenance-inbox/types";

export function MaintenanceInbox({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const inboxKey = getGetPropertyMaintenanceInboxQueryKey(propertyId);
  const { data, isLoading } = useGetPropertyMaintenanceInbox(propertyId, {
    query: { queryKey: inboxKey, refetchInterval: 60_000 },
  });

  const { data: assets = [] } = useListAssets(propertyId, undefined, {
    query: { queryKey: getListAssetsQueryKey(propertyId), staleTime: 5 * 60 * 1000 },
  });

  async function markDone(taskId: string, payload: CompletePayload) {
    try {
      await completeMaintenanceTask(taskId, { ...payload, completedDate: new Date().toLocaleDateString("en-CA") });
    } catch (err) {
      toast({ title: t("maintenance.toast.completeFailed"), variant: "destructive" });
      throw err;
    }
    toast({ title: t("maintenance.toast.completed"), description: t("maintenance.toast.nextScheduled") });
    invalidateAfterTaskCompletion(queryClient, propertyId);
  }

  async function editTask(taskId: string, updates: TaskFormPayload) {
    try {
      await updateMaintenanceTask(taskId, updates);
    } catch (err) {
      toast({ title: t("maintenance.toast.updateFailed"), variant: "destructive" });
      throw err;
    }
    toast({ title: t("maintenance.toast.updated") });
    queryClient.invalidateQueries({ queryKey: inboxKey });
    queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
  }

  async function deleteTask(taskId: string) {
    try {
      await deleteMaintenanceTask(taskId);
    } catch (err) {
      toast({ title: t("maintenance.toast.deleteFailed"), variant: "destructive" });
      throw err;
    }
    toast({ title: t("maintenance.toast.deleted") });
    queryClient.invalidateQueries({ queryKey: inboxKey });
    queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
  }

  async function createTask(assetId: string, body: TaskFormPayload) {
    try {
      await createMaintenanceTask(assetId, body);
    } catch (err) {
      toast({ title: t("maintenance.toast.createFailed"), variant: "destructive" });
      throw err;
    }
    toast({ title: t("maintenance.toast.added"), description: t("maintenance.toast.addedDesc") });
    setAddOpen(false);
    queryClient.invalidateQueries({ queryKey: inboxKey });
    queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6 pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 mt-1" />
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const total = overdue.length + upcoming.length;

  return (
    <Card className={overdue.length > 0 ? "border-destructive/25" : ""}>
      <CardHeader className="px-4 sm:px-6 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{t("maintenance.inboxTitle")}</CardTitle>
              {total > 0 && (
                <Badge
                  className={`text-[10px] font-bold px-1.5 py-0.5 h-auto shrink-0 ${
                    overdue.length > 0
                      ? "bg-destructive/15 text-destructive border-destructive/25"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}
                >
                  {total}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5 text-wrap">
              {overdue.length > 0
                ? t("maintenance.summaryOverdue", { overdue: overdue.length, upcoming: upcoming.length })
                : upcoming.length > 0
                ? t("maintenance.summaryUpcoming", { count: upcoming.length })
                : t("maintenance.summaryClear")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {total > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                {t("maintenance.tapDone")}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setAddOpen((v) => !v)}
            >
              {addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {addOpen ? t("common.cancel") : t("maintenance.newTask")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 space-y-3 pt-0">
        {total === 0 && !addOpen ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <div className="bg-emerald-100 p-3 rounded-full">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("maintenance.allCaughtUp")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("maintenance.noTasksNext30")}</p>
            </div>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive uppercase tracking-wide">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t("maintenance.overdueHeading", { count: overdue.length })}
                </div>
                {overdue.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={true}
                    onDone={markDone}
                    onEdit={editTask}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="space-y-2">
                {overdue.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide pt-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t("maintenance.dueThisMonthHeading", { count: upcoming.length })}
                  </div>
                )}
                {upcoming.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={false}
                    onDone={markDone}
                    onEdit={editTask}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {addOpen && (
          <div className="border rounded-xl overflow-hidden">
            <NewTaskForm
              propertyId={propertyId}
              assets={assets}
              onSave={createTask}
              onCancel={() => setAddOpen(false)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
