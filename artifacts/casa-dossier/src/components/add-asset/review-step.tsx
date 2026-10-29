import { useTranslation } from "react-i18next";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Sparkles, ArrowRight, ChevronLeft, PenLine, Tag, Hash, Calendar, DollarSign } from "lucide-react";
import { CATEGORIES, CATEGORY_ICONS, type Category, type ScanResult } from "./constants";

export type AssetForm = {
  name: string;
  category: Category;
  brand: string;
  model: string;
  serialNumber: string;
  installDate: string;
  replacementCost: string;
  warrantyExpiry: string;
};

export const EMPTY_ASSET_FORM: AssetForm = {
  name: "",
  category: "HVAC",
  brand: "",
  model: "",
  serialNumber: "",
  installDate: "",
  replacementCost: "",
  warrantyExpiry: "",
};

export type AssetFormErrors = { name?: string; replacementCost?: string };

export function ReviewStep({
  form,
  setField,
  errors,
  clearError,
  scanResult,
  saveBusy,
  onBack,
  onSave,
}: {
  form: AssetForm;
  setField: <K extends keyof AssetForm>(key: K, value: AssetForm[K]) => void;
  errors: AssetFormErrors;
  clearError: (key: keyof AssetFormErrors) => void;
  scanResult: ScanResult | null;
  saveBusy: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const fieldsFilled = [form.brand, form.model, form.serialNumber].filter(Boolean).length;
  const aiTag = <span className="text-emerald-600 text-xs">{t("addAsset.aiTag")}</span>;

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${scanResult ? "bg-emerald-100" : "bg-muted"}`}>
            {scanResult
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : <PenLine className="h-5 w-5 text-muted-foreground" />
            }
          </div>
          <div>
            <DialogTitle className="text-lg">
              {scanResult ? t("addAsset.reviewTitle") : t("addAsset.detailsTitle")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {scanResult
                ? t("addAsset.reviewSubtitle", { count: fieldsFilled })
                : t("addAsset.detailsSubtitle")}
            </p>
          </div>
        </div>
      </DialogHeader>

      {/* AI extraction summary banner */}
      {scanResult && (
        <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 space-y-0.5">
            <p className="font-semibold">
              {t("addAsset.extractedFields", {
                count: fieldsFilled + (scanResult.manufactureDate ? 1 : 0) + (scanResult.estimatedReplacementCost ? 1 : 0),
              })}
            </p>
            <p className="text-emerald-700">{t("addAsset.reviewBeforeSaving")}</p>
          </div>
        </div>
      )}

      <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="add-asset-name" className="text-xs font-medium text-muted-foreground">
            {t("addAsset.nameLabel")} <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="add-asset-name"
            value={form.name}
            onChange={(e) => { setField("name", e.target.value); if (errors.name) clearError("name"); }}
            placeholder={t("addAsset.namePlaceholder")}
            autoFocus
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "add-asset-name-error" : undefined}
          />
          <FieldError id="add-asset-name-error" message={errors.name} />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="add-asset-category" className="text-xs font-medium text-muted-foreground">{t("addAsset.categoryLabel")}</Label>
          <Select value={form.category} onValueChange={(v) => setField("category", v as Category)}>
            <SelectTrigger id="add-asset-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_ICONS[c]} {t(`assets.category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-asset-brand" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />{t("addAsset.brandLabel")}
              {scanResult?.brand && aiTag}
            </Label>
            <Input id="add-asset-brand" value={form.brand} onChange={(e) => setField("brand", e.target.value)} placeholder={t("addAsset.brandPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-asset-model" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              {t("addAsset.modelLabel")}
              {scanResult?.model && aiTag}
            </Label>
            <Input id="add-asset-model" value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder={t("common.optional")} className="font-mono text-sm" />
          </div>
        </div>

        {/* Serial Number */}
        <div className="space-y-1.5">
          <Label htmlFor="add-asset-serial" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" />{t("addAsset.serialLabel")}
            {scanResult?.serialNumber && aiTag}
          </Label>
          <Input id="add-asset-serial" value={form.serialNumber} onChange={(e) => setField("serialNumber", e.target.value)} placeholder={t("addAsset.serialPlaceholder")} className="font-mono text-sm" />
        </div>

        {/* Install Date + Warranty Expiry */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-asset-install" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />{t("addAsset.installDateLabel")}
              {scanResult?.manufactureDate && aiTag}
            </Label>
            <Input
              id="add-asset-install"
              type="month"
              value={form.installDate}
              onChange={(e) => setField("installDate", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-asset-warranty" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />{t("addAsset.warrantyLabel")}
            </Label>
            <Input
              id="add-asset-warranty"
              type="month"
              value={form.warrantyExpiry}
              onChange={(e) => setField("warrantyExpiry", e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        {/* Replacement Cost */}
        <div className="space-y-1.5">
          <Label htmlFor="add-asset-cost" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />{t("addAsset.costLabel")}
            {scanResult?.estimatedReplacementCost && aiTag}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="add-asset-cost"
              value={form.replacementCost}
              onChange={(e) => { setField("replacementCost", e.target.value); if (errors.replacementCost) clearError("replacementCost"); }}
              placeholder="0"
              type="number"
              min={0}
              className="pl-7"
              aria-invalid={!!errors.replacementCost}
              aria-describedby={errors.replacementCost ? "add-asset-cost-error" : undefined}
            />
          </div>
          <FieldError id="add-asset-cost-error" message={errors.replacementCost} />
        </div>
      </div>

      <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("addAsset.aiWillGenerate")}
          </div>
          <Button onClick={onSave} disabled={saveBusy} className="gap-1.5">
            {t("addAsset.saveAndGenerate")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
