import { Trans, useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

/** Blurred placeholder + upgrade CTA shown on plans below Basic. */
export function CapitalOutlookLocked({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="bg-amber-100 dark:bg-amber-950 p-5 rounded-full">
        <Lock className="h-10 w-10 text-amber-600" />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-bold mb-2">{t("capitalOutlook.title")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <Trans i18nKey="capitalOutlook.lockedDesc" components={{ strong: <strong /> }} />
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={onUpgrade} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {t("healthScore.upgradeToBasic", { price: "$9.99" })}
        </Button>
      </div>
      <div className="relative w-full max-w-2xl mt-4 rounded-xl overflow-hidden border">
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex items-center justify-center">
          <Badge className="text-xs font-semibold px-3 py-1.5 bg-amber-500 text-white">
            <Lock className="h-3 w-3 mr-1.5" />
            {t("capitalOutlook.upgradeToUnlock")}
          </Badge>
        </div>
        <div className="p-6 space-y-3 opacity-40 pointer-events-none select-none">
          <div className="h-8 bg-muted rounded-xl w-48" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}
