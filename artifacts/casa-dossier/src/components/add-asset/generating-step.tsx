import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export function GeneratingStep({
  brand,
  model,
  onClose,
}: {
  brand: string;
  model: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const brandLabel = brand || t("addAsset.manufacturer");
  return (
    <>
      <div className="px-6 py-12 flex flex-col items-center text-center gap-5">
        <div className="relative">
          <div className="bg-primary/10 rounded-full p-5">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold">{t("addAsset.generatingTitle")}</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {model ? (
              <Trans
                i18nKey="addAsset.generatingDescModel"
                values={{ brand: brandLabel, model }}
                components={{ strong: <strong /> }}
              />
            ) : (
              t("addAsset.generatingDesc", { brand: brandLabel })
            )}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2 pt-2">
          {[
            t("addAsset.generatingStep1", { brand: brandLabel }),
            t("addAsset.generatingStep2"),
            t("addAsset.generatingStep3"),
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              {s}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t px-6 py-4 flex flex-col items-center gap-1.5">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
          {t("addAsset.closeCheckLater")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("addAsset.finishesInBackground")}</p>
      </div>
    </>
  );
}
