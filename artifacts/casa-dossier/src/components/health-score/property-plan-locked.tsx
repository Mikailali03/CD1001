import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ClipboardList, Lock, ShieldAlert, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

/** Blurred preview of the property plan with an upgrade overlay, for plans below Basic. */
export function PropertyPlanLocked({ onUpgrade, onClose }: { onUpgrade: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      {/* Blurred fake content underneath */}
      <div className="blur-sm pointer-events-none select-none space-y-6 pt-1 opacity-60" aria-hidden>
        <div className={`flex items-center gap-4 rounded-xl border p-4 bg-blue-50 border-blue-200`}>
          <div className="text-center min-w-[56px]">
            <p className="text-3xl font-bold leading-none text-blue-700">82</p>
            <p className="text-xs font-medium mt-0.5 text-blue-700">/ 100</p>
          </div>
          <div>
            <p className="font-semibold text-sm text-blue-700">{t("propertyHealth.scoreLabel", { label: t("dashboard.gradeGood"), grade: "B" })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("propertyHealth.assetsTracked", { count: 4 })} · {t("propertyHealth.overdueCount", { count: 2 })}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t("propertyHealth.assetsNeedingAttention")}</span>
            <Badge variant="secondary" className="ml-auto text-xs">2</Badge>
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border p-3 bg-amber-50 border-amber-200 h-14" />
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t("propertyHealth.next30Days")}</span>
            <Badge variant="secondary" className="ml-auto text-xs">3</Badge>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg border bg-muted/40" />
          ))}
        </div>
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-6 w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold">{t("healthScore.unlockTitle")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("propertyHealth.unlockDesc")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("propertyHealth.featureScores")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("propertyHealth.featurePlan")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("propertyHealth.featureInvestment")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={onUpgrade}
              className="w-full gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {t("healthScore.upgradeToBasic", { price: "$9.99" })}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              {t("healthScore.maybeLater")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
