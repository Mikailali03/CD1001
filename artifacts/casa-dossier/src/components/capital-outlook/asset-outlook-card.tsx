import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { CapitalOutlookAsset } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CATEGORY_ICONS, LifeBar, URGENCY_CONFIG, fmt } from "./parts";

export function AssetOutlookCard({ asset, propertyId }: { asset: CapitalOutlookAsset; propertyId: string }) {
  const { t } = useTranslation();
  const cfg = URGENCY_CONFIG[asset.urgency];
  return (
    <Link href={`/properties/${propertyId}/assets/${asset.id}`}>
      <Card className={`cursor-pointer hover:shadow-md transition-shadow border ${cfg.border}`}>
        <CardContent className="pt-4 pb-4 px-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICONS[asset.category] ?? "📦"}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight line-clamp-1">{asset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[asset.brand, asset.model].filter(Boolean).join(" · ") ||
                    t(`assets.category.${asset.category}`, { defaultValue: asset.category })}
                </p>
              </div>
            </div>
            <Badge className={`${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px] font-semibold shrink-0 whitespace-nowrap`}>
              {asset.urgency === "critical" && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
              {asset.urgency === "good" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
              {t(`capitalOutlook.urgency.${asset.urgency}`)}
            </Badge>
          </div>

          {/* Life bar */}
          {asset.percentLifeUsed != null && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t("capitalOutlook.lifeUsed", { pct: asset.percentLifeUsed })}</span>
                <span>{t("capitalOutlook.lifespanYears", { count: asset.expectedLifespanYears })}</span>
              </div>
              <LifeBar percent={asset.percentLifeUsed} urgency={asset.urgency} />
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-xs mt-3">
            <div>
              <p className="text-muted-foreground">{t("capitalOutlook.installed")}</p>
              <p className="font-medium">{asset.installYear ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("capitalOutlook.replaceBy")}</p>
              <p className={`font-semibold ${asset.urgency === "critical" ? "text-destructive" : asset.urgency === "warning" ? "text-amber-600" : ""}`}>
                {asset.replacementYear ?? "—"}
                {asset.yearsRemaining != null && (
                  <span className="font-normal text-muted-foreground">
                    {" "}({asset.yearsRemaining <= 0 ? t("capitalOutlook.past") : t("capitalOutlook.yearsShort", { count: asset.yearsRemaining })})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("maintenance.estCost")}</p>
              <p className="font-semibold">
                {asset.replacementCost != null ? fmt(asset.replacementCost) : <span className="text-muted-foreground font-normal">—</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
