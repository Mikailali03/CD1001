import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, Sparkles, ArrowRight, Wand2, ClipboardList } from "lucide-react";

export function OnboardingDoneStep({
  scoutResult,
  onFinish,
}: {
  scoutResult: { taskCount: number } | null;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-emerald-100 rounded-full p-5">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">{t("onboarding.doneTitle")}</h2>
          <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {t("onboarding.doneSubtitle")}
          </p>
        </div>
      </div>

      {scoutResult && scoutResult.taskCount > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-left">
          <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {t("onboarding.tasksGenerated", { count: scoutResult.taskCount })}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {t("onboarding.tasksGeneratedDesc")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {([
          { icon: Building2,    labelKey: "confirmProperty" },
          { icon: Wand2,        labelKey: "confirmAI" },
          { icon: ClipboardList, labelKey: "confirmTasks" },
        ] as const).map(({ icon: Icon, labelKey }) => (
          <div
            key={labelKey}
            className="rounded-xl border bg-card p-4 flex flex-col items-center gap-2"
          >
            <div className="bg-emerald-100 rounded-lg p-2">
              <Icon className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-center leading-tight">{t(`onboarding.${labelKey}`)}</p>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="gap-2 px-8 w-full"
        onClick={onFinish}
      >
        {t("onboarding.goToDashboard")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
