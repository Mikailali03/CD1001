import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  deleteMaintenanceTask,
  getListMaintenanceTasksQueryKey,
  type MaintenanceTask,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCheck, CheckCircle2, Clock, DollarSign, Hammer, Loader2, Pencil, Trash2 } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { EditTaskModal } from "./edit-task-modal";
import { MaintenanceTaskModal } from "./maintenance-task-modal";
import { dueLabel } from "./due-label";

// ── Mark Complete Form (row + modal trigger) ──────────────────────────────────
export function MarkCompleteForm({
  task,
  assetId,
  propertyId,
  onDismiss,
}: {
  task: MaintenanceTask;
  assetId: string;
  propertyId: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const today = new Date();
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), today);
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await deleteMaintenanceTask(task.id);
      toast({ title: t("assetDetail.toast.taskDeleted") });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      onDismiss();
    } catch {
      toast({ title: t("assetDetail.toast.taskDeleteFailed"), variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 flex items-center gap-2.5 animate-in fade-in">
        <CheckCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm font-semibold text-emerald-700">{t("assetDetail.task.doneSaved")}</p>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-xl border overflow-hidden ${isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border"}`}>
        {/* Main row */}
        <div className="flex items-start gap-2 px-3.5 py-3">
          {/* Clickable left area */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex-1 text-left min-w-0 space-y-1.5 hover:opacity-80 transition-opacity"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-semibold text-sm leading-tight">{task.title}</p>
              {task.isDiy && (
                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 h-4">
                  <Hammer className="h-2.5 w-2.5" />{t("assetDetail.task.diy")}
                </Badge>
              )}
              {!!task.estimatedCost && Number(task.estimatedCost) > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 gap-0.5">
                  <DollarSign className="h-2.5 w-2.5" />{Number(task.estimatedCost).toLocaleString()}
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>
            )}
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : isSoon ? "text-amber-600" : "text-muted-foreground"}`}>
              {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {dueLabel(t, diff, task.nextDueDate, true)}
              {!!task.intervalDays && <span className="text-muted-foreground font-normal">{t("assetDetail.due.everyInline", { days: task.intervalDays })}</span>}
            </div>
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t("assetDetail.task.editTask")}
              aria-label={t("assetDetail.task.editNamed", { title: task.title })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t("assetDetail.task.deleteTask")}
              aria-label={t("assetDetail.task.deleteNamed", { title: task.title })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2 h-6 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              {t("assetDetail.task.markDone")}
            </button>
          </div>
        </div>

        {/* Delete confirm bar */}
        {deleteConfirm && (
          <div className="border-t bg-destructive/5 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-destructive font-medium">{t("assetDetail.task.deleteConfirm")}</p>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDeleteConfirm(false)} disabled={deleteBusy}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" onClick={handleDelete} disabled={deleteBusy}>
                {deleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                {t("common.delete")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <MaintenanceTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={task}
        assetId={assetId}
        propertyId={propertyId}
        onComplete={() => {
          setDone(true);
          setModalOpen(false);
          setTimeout(onDismiss, 900);
        }}
      />

      <EditTaskModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        task={task}
        assetId={assetId}
      />
    </>
  );
}
