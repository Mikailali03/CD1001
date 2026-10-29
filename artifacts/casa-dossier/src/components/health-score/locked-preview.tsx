import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, ClipboardList, Hammer, Lock, ShieldCheck, Sparkles } from "lucide-react";

/** Blurred preview of the plan with an upgrade overlay, for plans below Basic. */
export function LockedPlanPreview({
  onUpgrade,
  onClose,
}: {
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative flex-1">
      {/* Blurred fake content */}
      <div className="blur-sm pointer-events-none select-none opacity-50 px-6 py-4 space-y-4" aria-hidden>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4 text-destructive" />
          <span className="text-sm font-semibold">{t("healthScore.fixFirst")}</span>
          <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold ml-auto">{t("healthScore.remaining", { count: 3 })}</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-destructive/25 bg-destructive/5" />
        ))}
        <Separator />
        <div className="flex items-center gap-2 mb-3">
          <Hammer className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("healthScore.recommendedByManufacturers")}</span>
          <Badge variant="secondary" className="text-[10px] font-bold ml-auto">{t("healthScore.diyFirst")}</Badge>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg border bg-card" />
        ))}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-6 w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold">{t("healthScore.unlockTitle")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("healthScore.unlockDesc")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("healthScore.featureOverdueAlerts")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("healthScore.featureSpecs")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="leading-snug text-center">{t("healthScore.featureTips")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={onUpgrade} className="w-full gap-2">
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
