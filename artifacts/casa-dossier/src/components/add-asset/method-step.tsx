import { useTranslation } from "react-i18next";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scan, CheckCircle2, ArrowRight, PenLine, Wrench, Lock } from "lucide-react";

export function MethodStep({
  aiScanLocked,
  onUpgrade,
  onLens,
  onManual,
  onCancel,
}: {
  aiScanLocked: boolean;
  onUpgrade: () => void;
  onLens: () => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-lg">{t("addAsset.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{t("addAsset.subtitle")}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-6 space-y-3">
        {/* AI Lens option */}
        <button
          onClick={aiScanLocked ? onUpgrade : onLens}
          className={`w-full text-left rounded-xl border-2 transition-all p-4 group ${
            aiScanLocked
              ? "border-muted bg-muted/30 opacity-70 cursor-pointer"
              : "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`rounded-xl p-3 shrink-0 ${aiScanLocked ? "bg-muted" : "bg-primary/15"}`}>
              {aiScanLocked ? (
                <Lock className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Scan className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm">{t("addAsset.aiLens")}</p>
                {aiScanLocked ? (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-semibold px-1.5 py-0">
                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                    {t("addAsset.upgradeToBasic")}
                  </Badge>
                ) : (
                  <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-semibold px-1.5 py-0">{t("addAsset.recommended")}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {aiScanLocked ? t("addAsset.aiLensLockedDesc") : t("addAsset.aiLensDesc")}
              </p>
              {!aiScanLocked && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {(["perkAutofill", "perkAnyLabel", "perkEstimate"] as const).map((key) => (
                    <span key={key} className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                      <CheckCircle2 className="h-3 w-3" />{t(`addAsset.${key}`)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ArrowRight className={`h-4 w-4 shrink-0 mt-1 transition-colors ${aiScanLocked ? "text-muted-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
          </div>
        </button>

        {/* Manual option */}
        <button
          onClick={onManual}
          className="w-full text-left rounded-xl border hover:border-muted-foreground/40 hover:bg-muted/30 transition-all p-4 group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-muted rounded-xl p-3 shrink-0">
              <PenLine className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{t("addAsset.enterManually")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("addAsset.enterManuallyDesc")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </div>
        </button>
      </div>

      <div className="border-t px-6 py-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </>
  );
}
