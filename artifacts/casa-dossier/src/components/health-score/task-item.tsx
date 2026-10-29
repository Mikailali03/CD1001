import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, CheckCircle2, Hammer } from "lucide-react";
import { format } from "@/lib/date";
import { CompletionForm } from "./completion-form";
import type { CompletePayload, OverdueTask } from "./types";

export function TaskItem({
  task,
  done,
  onMarkDone,
}: {
  task: OverdueTask;
  done: boolean;
  onMarkDone: (taskId: string, payload: CompletePayload) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.floor((Date.now() - new Date(task.nextDueDate).getTime()) / 86_400_000);

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-800 line-through opacity-70 truncate">{task.title}</p>
        </div>
        <span className="text-xs text-emerald-600 font-semibold shrink-0">{t("healthScore.doneCheck")}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 overflow-hidden">
      <div className="flex items-start gap-2.5 p-3">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {task.assetName && <span className="font-medium">{task.assetName} · </span>}
            <span className="text-destructive/80 font-medium">{t("healthScore.daysOverdueShort", { count: daysOverdue })}</span>
            {" · "}
            {t("healthScore.wasDue", { date: format(new Date(task.nextDueDate), "MMM d, yyyy") })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.isDiy && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
              <Hammer className="h-2.5 w-2.5" /> {t("maintenance.diy")}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => setExpanded(!expanded)}
          >
            <Check className="h-3 w-3" /> {t("common.done")}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <CompletionForm
            isDiyDefault={task.isDiy ?? true}
            estimatedCost={task.estimatedCost}
            titleHint={task.title}
            onDone={(payload) => onMarkDone(task.id, payload)}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}
