import { useTranslation } from "react-i18next";
import type { Property, PropertySummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Bath, BedDouble, Building2, CalendarDays, Ruler } from "lucide-react";

// ── Property photo, dossier health and metadata ───────────────────────────────
export function PropertySummaryCard({ property, summary }: { property: Property; summary?: PropertySummary }) {
  const { t } = useTranslation();
  const healthScore = summary?.healthScore ?? 0;
  const healthColor = healthScore >= 80 ? "text-chart-1" : healthScore >= 50 ? "text-chart-3" : "text-destructive";

  return (
    <Card>
      {property.photoUrl ? (
        <div className="h-44 w-full overflow-hidden rounded-t-xl">
          <img src={property.photoUrl} alt={property.name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-32 w-full bg-muted/50 rounded-t-xl flex items-center justify-center">
          <Building2 className="h-10 w-10 text-muted-foreground/20" />
        </div>
      )}
      <CardContent className="pt-5 space-y-5">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium">{t("propertyDetail.dossierHealth")}</span>
            <span className={`text-sm font-bold ${healthColor}`}>{healthScore}/100</span>
          </div>
          <Progress value={healthScore} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1.5">
            {t("propertyDetail.verifiedOf", { verified: summary?.verifiedAssets ?? 0, count: summary?.totalAssets ?? 0 })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">{t("propertyDetail.overdueTasks")}</p>
            <p className={`text-xl font-bold ${(summary?.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-chart-1"}`}>
              {summary?.overdueTaskCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("propertyDetail.totalAssets")}</p>
            <p className="text-xl font-bold">{summary?.totalAssets ?? 0}</p>
          </div>
        </div>

        {/* Property metadata */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t text-sm">
          {!!property.yearBuilt && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{t("propertyDetail.built", { year: property.yearBuilt })}</span>
            </div>
          )}
          {!!property.sqft && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Ruler className="h-3.5 w-3.5 shrink-0" />
              <span>{t("propertyDetail.sqft", { value: property.sqft.toLocaleString() })}</span>
            </div>
          )}
          {!!property.bedrooms && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BedDouble className="h-3.5 w-3.5 shrink-0" />
              <span>{t("propertyDetail.beds", { count: property.bedrooms })}</span>
            </div>
          )}
          {!!property.bathrooms && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Bath className="h-3.5 w-3.5 shrink-0" />
              <span>{t("propertyDetail.baths", { count: Number(property.bathrooms) })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
