import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStarterAssets,
  getGetStarterAssetsQueryKey,
  addStarterAssets,
  getListAssetsQueryKey,
  getGetPropertySummaryQueryKey,
  type HomeType,
  type StarterAssetSuggestion,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Loader2, ListChecks, AlertTriangle } from "lucide-react";

const HOME_TYPES: HomeType[] = ["single_family", "townhouse", "condo"];

/**
 * A one-tap checklist of common systems and appliances for a new home, based on
 * its age and type. Install years are estimated from the year built and saved
 * with a note asking the owner to confirm them.
 */
export function StarterAssetsChecklist({
  propertyId,
  onDone,
  onSkip,
  skipLabel,
}: {
  propertyId: string;
  /** Called after assets are added (with how many) or when there's nothing to suggest. */
  onDone?: (added: number) => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [homeType, setHomeType] = useState<HomeType | undefined>(undefined);
  const params = homeType ? { homeType } : undefined;
  const { data, isLoading } = useGetStarterAssets(propertyId, params, {
    query: { queryKey: getGetStarterAssetsQueryKey(propertyId, params) },
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Re-tick the recommended items whenever the list changes (e.g. home type switched).
  useEffect(() => {
    if (data) setSelected(new Set(data.suggestions.filter((s) => s.recommended).map((s) => s.key)));
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function submit() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const created = await addStarterAssets(propertyId, { keys: [...selected], homeType: data!.homeType });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getGetStarterAssetsQueryKey(propertyId) }),
      ]);
      toast({ title: t("starterAssets.added", { count: created.length }) });
      onDone?.(created.length);
    } catch (err) {
      toast({ title: t("starterAssets.addFailed"), description: apiErrorMessage(err, ""), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const label = (s: StarterAssetSuggestion) => t(`starterAssets.items.${s.key}`, { defaultValue: s.name });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t("starterAssets.homeType")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("starterAssets.homeType")}>
          {HOME_TYPES.map((ht) => (
            <button
              key={ht}
              type="button"
              role="radio"
              aria-checked={data.homeType === ht}
              onClick={() => setHomeType(ht)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                data.homeType === ht ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted",
              )}
            >
              {t(`starterAssets.homeTypes.${ht}`)}
            </button>
          ))}
        </div>
      </div>

      {data.suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("starterAssets.nothingToSuggest")}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {data.suggestions.map((s) => {
            const id = `starter-${s.key}`;
            return (
              <li key={s.key} className="flex items-start gap-3 px-4 py-3">
                <Checkbox id={id} checked={selected.has(s.key)} onCheckedChange={() => toggle(s.key)} className="mt-0.5" />
                <label htmlFor={id} className="flex-1 min-w-0 cursor-pointer">
                  <span className="block text-sm font-medium">{label(s)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.estimatedInstallYear != null
                      ? t("starterAssets.estimatedYear", { year: s.estimatedInstallYear })
                      : t("starterAssets.unknownYear")}
                  </span>
                  {s.reasonCode && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                      {t(`starterAssets.reasons.${s.reasonCode}`, { defaultValue: s.reason ?? "" })}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{t("starterAssets.confirmNote")}</p>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} disabled={busy}>
            {skipLabel ?? t("starterAssets.skip")}
          </Button>
        )}
        {data.suggestions.length === 0 ? (
          onDone && <Button onClick={() => onDone(0)}>{t("starterAssets.continue")}</Button>
        ) : (
          <Button onClick={submit} disabled={busy || selected.size === 0} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
            {t("starterAssets.addSelected", { count: selected.size })}
          </Button>
        )}
      </div>
    </div>
  );
}
