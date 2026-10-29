import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  updateAsset,
  getGetAssetQueryKey,
  getListAssetsQueryKey,
  getGetPropertySummaryQueryKey,
  getGetCapitalOutlookQueryKey,
  type Asset as ApiAsset,
  type UpdateAssetBody,
} from "@workspace/api-client-react";
import { compressImage, uploadToStorage, PHOTO_MAX_PX } from "@/lib/upload";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { AssetPhotoField } from "@/components/edit-asset/asset-photo-field";
import { RetireAssetDialog } from "@/components/edit-asset/retire-asset-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Tag,
  Hash,
  Calendar,
  DollarSign,
  FileText,
  ShieldCheck,
  Archive,
  ArchiveRestore,
} from "lucide-react";

const CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roof",
  "Appliance",
  "Structural",
  "Other",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

type Asset = {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: string | null;
  // Numeric DB columns arrive as strings ("45.00") despite the generated type.
  replacementCost?: string | number | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  status?: string | null;
  retiredAt?: string | Date | null;
  photoUrl?: string | null;
};

type Props = {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: ApiAsset) => void;
};

export function EditAssetSheet({ asset, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [unretireDialogOpen, setUnretireDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ name?: string; replacementCost?: string }>({});

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isRetired = !!asset?.retiredAt;

  useEffect(() => {
    if (!asset) return;
    setName(asset.name ?? "");
    setCategory((asset.category as Category) ?? "HVAC");
    setBrand(asset.brand ?? "");
    setModel(asset.model ?? "");
    setSerialNumber(asset.serialNumber ?? "");
    setInstallDate(asset.installDate ? asset.installDate.substring(0, 7) : "");
    setReplacementCost(
      asset.replacementCost ? String(Number(asset.replacementCost)) : ""
    );
    setWarrantyExpiry(
      asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 7) : ""
    );
    setNotes(asset.notes ?? "");
    setPhotoPreview(asset.photoUrl ?? null);
    setPendingPhotoUrl(null);
    setErrors({});
  }, [asset]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      setPendingPhotoUrl(await uploadToStorage(await compressImage(file, PHOTO_MAX_PX)));
    } catch (err) {
      toast({ title: t("editAsset.toast.photoUploadFailed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setPhotoPreview(asset?.photoUrl ?? null);
      setPendingPhotoUrl(null);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPendingPhotoUrl("");
  }

  function invalidateAssetQueries() {
    if (!asset) return;
    // getListAssetsQueryKey(propertyId) prefix-matches the includeRetired variant too.
    queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(asset.id) });
    queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(asset.propertyId) });
    queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(asset.propertyId) });
    queryClient.invalidateQueries({ queryKey: getGetCapitalOutlookQueryKey(asset.propertyId) });
  }

  async function handleSave() {
    if (!asset) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("editAsset.errors.nameRequired");
    if (replacementCost && parseFloat(replacementCost) < 0) next.replacementCost = t("editAsset.errors.costNegative");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        installDate: installDate ? `${installDate}-01` : null,
        replacementCost: replacementCost ? parseFloat(replacementCost) : null,
        warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : null,
        notes: notes.trim() || null,
      };
      // Only send photoUrl when it has been changed (pendingPhotoUrl !== null)
      if (pendingPhotoUrl !== null) {
        body.photoUrl = pendingPhotoUrl || null;
      }
      // The server treats null as "clear this field"; the spec only types string | undefined.
      const updated = await updateAsset(asset.id, body as UpdateAssetBody);
      toast({ title: t("editAsset.toast.updated"), description: t("editAsset.toast.updatedDesc", { name }) });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: t("editAsset.toast.saveFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleRetire() {
    if (!asset) return;
    setBusy(true);
    try {
      const updated = await updateAsset(asset.id, { retiredAt: new Date().toISOString() });
      toast({ title: t("editAsset.toast.retired"), description: t("editAsset.toast.retiredDesc", { name: asset.name }) });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: t("editAsset.toast.retireFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
      setRetireDialogOpen(false);
    }
  }

  async function handleUnretire() {
    if (!asset) return;
    setBusy(true);
    try {
      const updated = await updateAsset(asset.id, { retiredAt: null });
      toast({ title: t("editAsset.toast.restored"), description: t("editAsset.toast.restoredDesc", { name: asset.name }) });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: t("editAsset.toast.restoreFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
      setUnretireDialogOpen(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              {asset ? CATEGORY_ICONS[asset.category] ?? "📦" : ""}
              {isRetired ? t("editAsset.titleRetired") : t("editAsset.title")}
            </SheetTitle>
            <SheetDescription>
              {isRetired ? t("editAsset.descriptionRetired") : t("editAsset.description")}
            </SheetDescription>
          </SheetHeader>

          {isRetired && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Archive className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{t("editAsset.retiredNotice")}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Photo */}
            <AssetPhotoField
              photoPreview={photoPreview}
              uploading={uploading}
              onFileChange={handleFileChange}
              onRemove={removePhoto}
            />

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-name" className="text-xs font-semibold">
                {t("editAsset.name")} <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="edit-asset-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
                placeholder={t("editAsset.namePlaceholder")}
                autoFocus
                required
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "edit-asset-name-error" : undefined}
              />
              <FieldError id="edit-asset-name-error" message={errors.name} />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-category" className="text-xs font-semibold">{t("editAsset.category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
              >
                <SelectTrigger id="edit-asset-category">
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
                <Label htmlFor="edit-asset-brand" className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {t("editAsset.brand")}
                </Label>
                <Input
                  id="edit-asset-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={t("editAsset.brandPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-asset-model" className="text-xs font-semibold">{t("editAsset.model")}</Label>
                <Input
                  id="edit-asset-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t("common.optional")}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Serial Number */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-serial" className="text-xs font-semibold flex items-center gap-1">
                <Hash className="h-3 w-3" /> {t("editAsset.serial")}
              </Label>
              <Input
                id="edit-asset-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={t("editAsset.serialPlaceholder")}
                className="font-mono text-sm"
              />
            </div>

            {/* Install Date + Replacement Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-asset-install" className="text-xs font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {t("editAsset.installDate")}
                </Label>
                <Input
                  id="edit-asset-install"
                  type="month"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-asset-cost" className="text-xs font-semibold flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> {t("editAsset.replacementCost")}
                </Label>
                <Input
                  id="edit-asset-cost"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="0"
                  value={replacementCost}
                  onChange={(e) => { setReplacementCost(e.target.value); if (errors.replacementCost) setErrors((p) => ({ ...p, replacementCost: undefined })); }}
                  className="text-sm"
                  aria-invalid={!!errors.replacementCost}
                  aria-describedby={errors.replacementCost ? "edit-asset-cost-error" : undefined}
                />
                <FieldError id="edit-asset-cost-error" message={errors.replacementCost} />
              </div>
            </div>

            {/* Warranty Expiry */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-warranty" className="text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> {t("editAsset.warrantyExpiry")}
              </Label>
              <Input
                id="edit-asset-warranty"
                type="month"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-notes" className="text-xs font-semibold flex items-center gap-1">
                <FileText className="h-3 w-3" /> {t("editAsset.notes")}
              </Label>
              <Textarea
                id="edit-asset-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("editAsset.notesPlaceholder")}
                className="resize-none h-20 text-sm"
              />
            </div>

            {/* Save */}
            <div className="pt-2">
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={busy || uploading}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> {t("common.saveChanges")}
                  </>
                )}
              </Button>
            </div>

            {/* Retire / Unretire */}
            <div className="pt-1 border-t">
              {isRetired ? (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-chart-1 border-chart-1/30 hover:bg-chart-1/5 hover:text-chart-1"
                  onClick={() => setUnretireDialogOpen(true)}
                  disabled={busy}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  {t("editAsset.restoreCta")}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => setRetireDialogOpen(true)}
                  disabled={busy}
                >
                  <Archive className="h-4 w-4" />
                  {t("editAsset.retireCta")}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Retire confirm */}
      <RetireAssetDialog
        mode="retire"
        name={asset?.name}
        open={retireDialogOpen}
        onOpenChange={setRetireDialogOpen}
        onConfirm={handleRetire}
      />

      {/* Unretire confirm */}
      <RetireAssetDialog
        mode="restore"
        name={asset?.name}
        open={unretireDialogOpen}
        onOpenChange={setUnretireDialogOpen}
        onConfirm={handleUnretire}
      />
    </>
  );
}
