import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  deleteMaintenanceTask,
  getListMaintenanceTasksQueryKey,
  type MaintenanceTask,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react";
import { format } from "@/lib/date";
import { EditTaskModal } from "./edit-task-modal";

// ── Completed Task Row (with edit/delete) ─────────────────────────────────────
export function CompletedTaskRow({ task, assetId }: { task: MaintenanceTask; assetId: string }) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await deleteMaintenanceTask(task.id);
      toast({ title: t("assetDetail.toast.taskDeleted") });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      setHidden(true);
    } catch {
      toast({ title: t("assetDetail.toast.taskDeleteFailed"), variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground group">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="flex-1 line-clamp-1">{task.title}</span>
        {task.completedAt && (
          <span className="shrink-0 text-xs">{format(new Date(task.completedAt), "MMM d")}</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
          <button onClick={() => setEditOpen(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title={t("common.edit")} aria-label={t("assetDetail.task.editNamed", { title: task.title })}>
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title={t("common.delete")} aria-label={t("assetDetail.task.deleteNamed", { title: task.title })}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {deleteConfirm && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5">
          <p className="text-xs text-destructive font-medium">{t("assetDetail.task.deleteConfirmNamed", { title: task.title })}</p>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setDeleteConfirm(false)} disabled={deleteBusy}>{t("common.cancel")}</Button>
            <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}{t("common.delete")}
            </Button>
          </div>
        </div>
      )}
      <EditTaskModal open={editOpen} onClose={() => setEditOpen(false)} task={task} assetId={assetId} />
    </>
  );
}
