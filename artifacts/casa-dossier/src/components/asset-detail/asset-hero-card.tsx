import { useTranslation } from "react-i18next";
import type { Asset } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
import { format } from "@/lib/date";
import { categoryConfig } from "@/lib/asset-scoring";
import { LargeRadialGauge, LifeBar } from "./asset-gauges";

// ── Hero card ─────────────────────────────────────────────────────────────────
export function AssetHeroCard({ asset, score, onEdit }: { asset: Asset; score: number; onEdit: () => void }) {
  const { t } = useTranslation();
  const cfg = categoryConfig(asset.category);
  const underWarranty = asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date();

  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col sm:flex-row items-start gap-5" style={{ borderColor: cfg.color + "30" }}>
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: cfg.bg }}>
          {cfg.emoji}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{asset.name}</h1>
            {underWarranty && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs font-bold">
                <ShieldCheck className="h-3 w-3" />{t("assetDetail.badges.underWarranty")}
              </Badge>
            )}
            {asset.status === "needs_attention" && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />{t("assetDetail.badges.needsAttention")}
              </Badge>
            )}
            {asset.status === "verified" && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                <ShieldCheck className="h-3 w-3" />{t("assetDetail.badges.verified")}
              </Badge>
            )}
            {asset.status === "unverified" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <ShieldAlert className="h-3 w-3" />{t("assetDetail.badges.unverified")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(`assets.category.${asset.category}`, { defaultValue: asset.category })}{asset.brand ? ` · ${asset.brand}` : ""}{asset.model ? ` · ${asset.model}` : ""}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {asset.serialNumber && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t("assets.serialNumber")} </span>
                <span className="font-mono font-semibold">{asset.serialNumber}</span>
              </div>
            )}
            {asset.installDate && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t("assetDetail.hero.installed")} </span>
                <span className="font-semibold">{format(new Date(asset.installDate), "MMM yyyy")}</span>
              </div>
            )}
            {asset.warrantyExpiry && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t("assetDetail.hero.warranty")} </span>
                <span className={`font-semibold ${underWarranty ? "text-emerald-600" : "text-destructive"}`}>
                  {underWarranty
                    ? t("assetDetail.hero.warrantyUntil", { date: format(new Date(asset.warrantyExpiry), "MMM yyyy") })
                    : t("assetDetail.hero.warrantyExpired")}
                </span>
              </div>
            )}
            {!!asset.replacementCost && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t("assetDetail.hero.estReplacement")} </span>
                <span className="font-semibold">${Number(asset.replacementCost).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="pt-2 max-w-xs">
            <LifeBar installDate={asset.installDate ?? null} category={asset.category} name={asset.name} />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 shrink-0">
        <LargeRadialGauge score={score} />
        <p className="text-xs text-muted-foreground font-medium">{t("assetDetail.hero.assetHealth")}</p>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-2.5 py-1 transition-colors bg-background"
        >
          <Pencil className="h-3 w-3" />
          {t("common.edit")}
        </button>
      </div>
    </div>
  );
}
