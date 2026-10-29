import { useTranslation } from "react-i18next";
import type { PropertyLookupResult } from "@workspace/api-client-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { CheckCircle2, Calendar, Maximize, BedDouble, Bath, ArrowRight, ChevronLeft } from "lucide-react";
import { StatBadge } from "./stat-badge";

export type PropertyForm = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  yearBuilt: string;
  sqft: string;
  bedrooms: string;
  bathrooms: string;
};

export const EMPTY_PROPERTY_FORM: PropertyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  yearBuilt: "",
  sqft: "",
  bedrooms: "",
  bathrooms: "",
};

export type PropertyFormErrors = { addressInput?: string; name?: string; address?: string; yearBuilt?: string };

export function VerifyStep({
  form,
  setField,
  errors,
  clearError,
  lookupResult,
  onBack,
  onNext,
}: {
  form: PropertyForm;
  setField: (key: keyof PropertyForm, value: string) => void;
  errors: PropertyFormErrors;
  clearError: (key: keyof PropertyFormErrors) => void;
  lookupResult: PropertyLookupResult | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <DialogTitle className="text-lg">{t("onboarding.verifyTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{t("onboarding.verifySubtitle")}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {lookupResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBadge icon={<Calendar className="h-3.5 w-3.5" />} label={t("onboarding.labelYearBuilt")} value={lookupResult.yearBuilt} />
            <StatBadge icon={<Maximize className="h-3.5 w-3.5" />} label={t("onboarding.labelSqFt")} value={lookupResult.sqft?.toLocaleString() ?? null} />
            <StatBadge icon={<BedDouble className="h-3.5 w-3.5" />} label={t("onboarding.labelBeds")} value={lookupResult.bedrooms} />
            <StatBadge icon={<Bath className="h-3.5 w-3.5" />} label={t("onboarding.labelBaths")} value={lookupResult.bathrooms} />
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="add-property-name" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelPropertyName")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="add-property-name"
              value={form.name}
              onChange={(e) => { setField("name", e.target.value); clearError("name"); }}
              placeholder={t("onboarding.propertyNamePlaceholder")}
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "add-property-name-error" : undefined}
            />
            <FieldError id="add-property-name-error" message={errors.name} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-property-address" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelStreetAddress")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="add-property-address"
              value={form.address}
              onChange={(e) => { setField("address", e.target.value); clearError("address"); }}
              required
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "add-property-address-error" : undefined}
            />
            <FieldError id="add-property-address-error" message={errors.address} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1 col-span-2">
              <Label htmlFor="add-property-city" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelCity")}</Label>
              <Input id="add-property-city" value={form.city} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-property-state" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelState")}</Label>
              <Input id="add-property-state" value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={2} placeholder={t("onboarding.statePlaceholder")} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="add-property-year" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelYearBuilt")}</Label>
              <Input
                id="add-property-year"
                value={form.yearBuilt}
                onChange={(e) => { setField("yearBuilt", e.target.value); clearError("yearBuilt"); }}
                type="number"
                placeholder="1990"
                aria-invalid={!!errors.yearBuilt}
                aria-describedby={errors.yearBuilt ? "add-property-year-error" : undefined}
              />
              <FieldError id="add-property-year-error" message={errors.yearBuilt} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-property-sqft" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelSqFt")}</Label>
              <Input id="add-property-sqft" value={form.sqft} onChange={(e) => setField("sqft", e.target.value)} type="number" placeholder="2000" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-property-beds" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelBeds")}</Label>
              <Input id="add-property-beds" value={form.bedrooms} onChange={(e) => setField("bedrooms", e.target.value)} type="number" placeholder="3" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-property-baths" className="text-xs font-medium text-muted-foreground">{t("onboarding.labelBaths")}</Label>
              <Input id="add-property-baths" value={form.bathrooms} onChange={(e) => setField("bathrooms", e.target.value)} type="number" step="0.5" placeholder="2" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Button>
        <Button onClick={onNext} className="gap-1.5">
          {t("addProperty.nextAddPhoto")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
