import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarterAssetsChecklist } from "@/components/starter-assets-checklist";
import { ListChecks } from "lucide-react";

const dismissKey = (propertyId: string) => `casa:starterAssetsDismissed:${propertyId}`;

/** Offers the starter-asset checklist on a home that has nothing tracked yet. */
export function StarterAssetsCard({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey(propertyId)) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(propertyId), "1");
    } catch {
      // Private mode: it just reappears next visit.
    }
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          {t("starterAssets.cardTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("starterAssets.cardSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <StarterAssetsChecklist propertyId={propertyId} onSkip={dismiss} skipLabel={t("starterAssets.dismiss")} />
      </CardContent>
    </Card>
  );
}
