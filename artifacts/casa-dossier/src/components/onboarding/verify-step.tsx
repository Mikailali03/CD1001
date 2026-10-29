import { useTranslation } from "react-i18next";
import type { PropertyLookupResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { StatBadge } from "@/components/add-property/stat-badge";
import type { PropertyForm, PropertyFormErrors } from "@/components/add-property/verify-step";
import { CheckCircle2, Sparkles, Calendar, Maximize, BedDouble, Bath, ArrowRight, ChevronLeft } from "lucide-react";

export function OnboardingVerifyStep({
  form,
  setField,
  errors,
  clearError,
  lookupResult,
  manualMode,
  saveBusy,
  onBack,
  onSave,
}: {
  form: PropertyForm;
  setField: (key: keyof PropertyForm, value: string) => void;
  errors: PropertyFormErrors;
  clearError: (key: keyof PropertyFormErrors) => void;
  lookupResult: PropertyLookupResult | null;
  manualMode: boolean;
  saveBusy: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("onboarding.back")}
        </button>
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-emerald-100 p-2.5 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              {manualMode ? t("onboarding.manualTitle") : t("onboarding.verifyTitle")}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {manualMode ? t("onboarding.manualSubtitle") : t("onboarding.verifySubtitle")}
            </p>
          </div>
        </div>
      </div>

      {lookupResult && !manualMode && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBadge icon={<Calendar className="h-3.5 w-3.5" />} label={t("onboarding.labelYearBuilt")} value={lookupResult.yearBuilt} />
          <StatBadge icon={<Maximize className="h-3.5 w-3.5" />} label={t("onboarding.labelSqFt")} value={lookupResult.sqft?.toLocaleString() ?? null} />
          <StatBadge icon={<BedDouble className="h-3.5 w-3.5" />} label={t("onboarding.labelBeds")} value={lookupResult.bedrooms} />
          <StatBadge icon={<Bath className="h-3.5 w-3.5" />} label={t("onboarding.labelBaths")} value={lookupResult.bathrooms} />
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-card p-5">
        <div className="space-y-1">
          <Label htmlFor="ob-name" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelPropertyName")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input
            id="ob-name"
            value={form.name}
            onChange={(e) => { setField("name", e.target.value); clearError("name"); }}
            placeholder={t("onboarding.propertyNamePlaceholder")}
            autoFocus={manualMode}
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "ob-name-error" : undefined}
          />
          <FieldError id="ob-name-error" message={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ob-street" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelStreetAddress")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input
            id="ob-street"
            value={form.address}
            onChange={(e) => { setField("address", e.target.value); clearError("address"); }}
            placeholder={t("onboarding.streetAddressPlaceholder")}
            required
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? "ob-street-error" : undefined}
          />
          <FieldError id="ob-street-error" message={errors.address} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1 col-span-2">
            <Label htmlFor="ob-city" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelCity")}</Label>
            <Input id="ob-city" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder={t("onboarding.cityPlaceholder")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-state" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelState")}</Label>
            <Input id="ob-state" value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={2} placeholder={t("onboarding.statePlaceholder")} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ob-year" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelYearBuilt")}</Label>
            <Input
              id="ob-year"
              value={form.yearBuilt}
              onChange={(e) => { setField("yearBuilt", e.target.value); clearError("yearBuilt"); }}
              type="number"
              placeholder="1990"
              aria-invalid={!!errors.yearBuilt}
              aria-describedby={errors.yearBuilt ? "ob-year-error" : undefined}
            />
            <FieldError id="ob-year-error" message={errors.yearBuilt} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-sqft" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelSqFt")}</Label>
            <Input id="ob-sqft" value={form.sqft} onChange={(e) => setField("sqft", e.target.value)} type="number" placeholder="2000" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-beds" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelBeds")}</Label>
            <Input id="ob-beds" value={form.bedrooms} onChange={(e) => setField("bedrooms", e.target.value)} type="number" placeholder="3" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ob-baths" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelBaths")}</Label>
            <Input id="ob-baths" value={form.bathrooms} onChange={(e) => setField("bathrooms", e.target.value)} type="number" step="0.5" placeholder="2" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("onboarding.scoutRunning")}
        </div>
        <Button
          onClick={onSave}
          disabled={saveBusy}
          className="gap-1.5"
        >
          {t("onboarding.saveAndGenerate")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
