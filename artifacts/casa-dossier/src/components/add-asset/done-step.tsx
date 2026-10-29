import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, ArrowRight, Calendar, Wrench } from "lucide-react";

export function DoneStep({
  name,
  taskCount,
  planBlocked,
  onUpgrade,
  onAddAnother,
  onView,
}: {
  name: string;
  taskCount: number | null;
  planBlocked: boolean;
  onUpgrade: () => void;
  onAddAnother: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
        <div className="bg-emerald-100 rounded-full p-5">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold">{t("addAsset.doneTitle", { name })}</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {planBlocked ? t("addAsset.doneDescBlocked") : t("addAsset.doneDesc")}
          </p>
        </div>

        {taskCount != null && taskCount > 0 ? (
          <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold text-emerald-800">
                {t("addAsset.tasksGenerated", { count: taskCount })}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t("addAsset.tasksGeneratedDesc")}
              </p>
            </div>
          </div>
        ) : planBlocked ? (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {t("addAsset.freePlanUsed")}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t("addAsset.freePlanUsedDesc")}
              </p>
            </div>
            <Button size="sm" className="shrink-0 text-xs" onClick={onUpgrade}>
              {t("addAsset.upgrade")}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 w-full text-xs text-muted-foreground">
          {[
            { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: t("addAsset.checkAdded") },
            { icon: <Sparkles className="h-3.5 w-3.5" />, text: planBlocked ? t("addAsset.checkPlanLocked") : t("addAsset.checkPlanGenerated") },
            { icon: <Calendar className="h-3.5 w-3.5" />, text: planBlocked ? t("addAsset.checkAddManually") : t("addAsset.checkScheduled") },
            { icon: <Wrench className="h-3.5 w-3.5" />, text: t("addAsset.checkVerified") },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={planBlocked && i === 1 ? "text-amber-500" : "text-emerald-600"}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t px-6 py-4 flex justify-between">
        <Button variant="outline" onClick={onAddAnother}>{t("addAsset.addAnother")}</Button>
        <Button onClick={onView} className="gap-1.5">
          {t("addAsset.viewAsset")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
