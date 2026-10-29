import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CheckCircle2, Hammer, Loader2, Pencil, Trash2, X } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { format } from "@/lib/date";
import { TaskCompleteForm } from "./task-complete-form";
import { TaskEditForm } from "./task-edit-form";
import { CATEGORY_ICONS, type CompletePayload, type InboxTask, type TaskFormPayload } from "./types";

type TaskRowProps = {
  task: InboxTask;
  isOverdue: boolean;
  onDone: (taskId: string, payload: CompletePayload) => Promise<void>;
  onEdit: (taskId: string, updates: TaskFormPayload) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
};

export function TaskRow({ task, isOverdue, onDone, onEdit, onDelete }: TaskRowProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "complete" | "edit" | "delete">("idle");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const today = new Date();
  const dueDate = new Date(task.nextDueDate);
  const daysDiff = differenceInCalendarDays(dueDate, today);
  const absdays = Math.abs(daysDiff);

  if (dismissed) return null;

  async function handleComplete(payload: CompletePayload) {
    await onDone(task.id, payload);
    setDismissed(true);
  }

  async function handleEdit(updates: TaskFormPayload) {
    await onEdit(task.id, updates);
    setMode("idle");
  }

  async function handleConfirmDelete() {
    setBusy(true);
    try {
      await onDelete(task.id);
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  const dateLabel = format(dueDate, "MMM d");

  return (
    <div
      className={`rounded-xl border transition-all ${
        isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border bg-card"
      } ${mode !== "idle" ? "shadow-sm" : ""}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        <span className="text-lg shrink-0 mt-0.5 select-none">
          {CATEGORY_ICONS[task.assetCategory] ?? "📦"}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight line-clamp-2">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">{task.assetName}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {task.isDiy && (
                <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5 py-0.5 h-auto">
                  <Hammer className="h-2.5 w-2.5" />
                  {t("maintenance.diy")}
                </Badge>
              )}
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : daysDiff <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
            {isOverdue ? (
              <AlertCircle className="h-3 w-3 shrink-0" />
            ) : (
              <Calendar className="h-3 w-3 shrink-0" />
            )}
            <span>
              {isOverdue
                ? t("maintenance.overdueBy", { count: absdays, date: dateLabel })
                : daysDiff === 0
                ? t("maintenance.dueToday")
                : daysDiff === 1
                ? t("maintenance.dueTomorrow")
                : t("maintenance.dueIn", { count: daysDiff, date: dateLabel })}
            </span>
            {!!task.estimatedCost && (
              <span className="text-muted-foreground font-normal">
                · {t("maintenance.estAmount", { amount: Number(task.estimatedCost).toLocaleString() })}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {mode === "idle" && (
            <>
              <button
                onClick={() => setMode("edit")}
                className="flex items-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={t("maintenance.editTask")}
                aria-label={t("maintenance.editNamed", { title: task.title })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode("delete")}
                className="flex items-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={t("maintenance.deleteTask")}
                aria-label={t("maintenance.deleteNamed", { title: task.title })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode("complete")}
                className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                aria-label={t("maintenance.markNamedDone", { title: task.title })}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("common.done")}</span>
              </button>
            </>
          )}
          {mode !== "idle" && (
            <button
              onClick={() => setMode("idle")}
              className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              aria-label={t("common.cancel")}
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("common.cancel")}</span>
            </button>
          )}
        </div>
      </div>

      {mode === "complete" && <TaskCompleteForm task={task} onSubmit={handleComplete} />}

      {mode === "edit" && <TaskEditForm task={task} onSubmit={handleEdit} />}

      {/* Delete confirm */}
      {mode === "delete" && (
        <div className="border-t bg-destructive/5 px-3 sm:px-4 py-3 rounded-b-xl flex items-center justify-between gap-3">
          <p className="text-xs text-destructive font-medium">{t("maintenance.deleteConfirm")}</p>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={busy}
            className="h-7 text-xs gap-1.5 shrink-0"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {busy ? t("common.deleting") : t("common.delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
