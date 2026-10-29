import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Hammer, UserCheck } from "lucide-react";
import { addDays } from "date-fns";
import { format } from "@/lib/date";
import type { MaintenanceSpec } from "@workspace/maintenance-specs";
import { CompletionForm } from "./completion-form";
import type { CompletePayload } from "./types";

export function SpecItem({
  spec,
  assetId,
  assetName,
  done,
  onMarkDone,
}: {
  spec: MaintenanceSpec;
  assetId: string;
  assetName: string;
  done: boolean;
  onMarkDone: (assetId: string, spec: MaintenanceSpec, payload: CompletePayload) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  // Next due = today (untracked recommendation — suggest starting now)
  const nextDueDate = new Date();
  const nextDueDateAfterCompletion = addDays(new Date(), spec.intervalDays);

  const intervalLabel =
    spec.intervalDays < 60
      ? t("healthScore.everyDays", { count: spec.intervalDays })
      : spec.intervalDays < 400
      ? t("healthScore.everyMonths", { count: Math.round(spec.intervalDays / 30) })
      : t("healthScore.everyYears", { count: Math.round(spec.intervalDays / 365) });

  const priorityColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-800 line-through opacity-70 truncate">{spec.title}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {t("healthScore.nextDueNowTracked", { date: format(nextDueDateAfterCompletion, "MMM d, yyyy") })}
          </p>
        </div>
        <span className="text-xs text-emerald-600 font-semibold shrink-0">{t("healthScore.doneCheck")}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {spec.isDiy ? (
              <Hammer className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            ) : (
              <UserCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{spec.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assetName} · {intervalLabel}
                {!!spec.estimatedMinutes && ` · ${t("healthScore.aboutMinutes", { count: spec.estimatedMinutes })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityColors[spec.priority]}`}>
              {t(`healthScore.priority.${spec.priority}`)}
            </span>
            {spec.isDiy ? (
              <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
                <Hammer className="h-2.5 w-2.5" /> {t("maintenance.diy")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-medium gap-0.5 px-1.5">
                <UserCheck className="h-2.5 w-2.5" /> {t("maintenance.pro")}
              </Badge>
            )}
          </div>
        </div>

        {/* Next due date */}
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            <span className="font-semibold">{t("healthScore.recommendedNow")}</span>
            {" · "}
            {t("healthScore.nextDueAfterCompletion", { date: format(nextDueDateAfterCompletion, "MMM d, yyyy") })}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{spec.description}</p>

        <div className="flex items-center gap-2">
          {spec.steps && spec.steps.length > 0 && (
            <button
              onClick={() => setStepsOpen(!stepsOpen)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {stepsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {stepsOpen ? t("healthScore.hideSteps") : t("healthScore.showSteps", { count: spec.steps.length })}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 ml-auto"
            onClick={() => setExpanded(!expanded)}
          >
            <Check className="h-3 w-3" /> {t("common.done")}
          </Button>
        </div>

        {stepsOpen && spec.steps && (
          <div>
            <ol className="mt-1 space-y-1.5 pl-4 list-decimal marker:text-muted-foreground">
              {spec.steps.map((step, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug pl-0.5">{step}</li>
              ))}
            </ol>
            {spec.toolsNeeded && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">{t("healthScore.tools")}</span>
                {spec.toolsNeeded.map((tool) => (
                  <span key={tool} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium">{tool}</span>
                ))}
              </div>
            )}
            {spec.safetyNotes && (
              <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800 leading-snug">
                ⚠️ {spec.safetyNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <CompletionForm
            isDiyDefault={spec.isDiy}
            titleHint={spec.title}
            onDone={(payload) => onMarkDone(assetId, spec, payload)}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}
