import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateProperty,
  getGetPropertyQueryKey,
  getListPropertiesQueryKey,
  type Property,
  type UpdatePropertyBody,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { useToast } from "@/hooks/use-toast";
import { compressImage, uploadToStorage, PHOTO_MAX_PX } from "@/lib/upload";
import {
  Building2,
  Camera,
  Loader2,
  X,
  ImagePlus,
} from "lucide-react";

type Props = {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function EditPropertySheet({ property, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const updateProperty = useUpdateProperty();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; address?: string; yearBuilt?: string }>({});
  const clearError = (key: keyof typeof errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  useEffect(() => {
    if (open && property) populate(property);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property?.id]);

  function populate(p: Property) {
    setName(p.name ?? "");
    setAddress(p.address ?? "");
    setCity(p.city ?? "");
    setState(p.state ?? "");
    setZipCode(p.zipCode ?? "");
    setYearBuilt(p.yearBuilt != null ? String(p.yearBuilt) : "");
    setSqft(p.sqft != null ? String(p.sqft) : "");
    setBedrooms(p.bedrooms != null ? String(p.bedrooms) : "");
    setBathrooms(p.bathrooms != null ? String(p.bathrooms) : "");
    setPhotoPreview(p.photoUrl ?? null);
    setPendingPhotoUrl(null);
    setErrors({});
  }

  function handleOpenChange(v: boolean) {
    if (v && property) populate(property);
    onOpenChange(v);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);
    setUploading(true);

    try {
      setPendingPhotoUrl(await uploadToStorage(await compressImage(file, PHOTO_MAX_PX)));
    } catch (err) {
      toast({ title: t("addProperty.photoUploadFailed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setPhotoPreview(property?.photoUrl ?? null);
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

  async function handleSave() {
    if (!property?.id) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("onboarding.errNameRequired");
    if (!address.trim()) next.address = t("onboarding.errStreetRequired");
    const year = yearBuilt ? parseInt(yearBuilt) : null;
    if (year != null && (year < 1600 || year > new Date().getFullYear() + 1)) next.yearBuilt = t("onboarding.errYearInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const patch: UpdatePropertyBody = {
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || null,
        state: state.trim() || null,
        zipCode: zipCode.trim() || null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
        sqft: sqft ? parseInt(sqft) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      };

      if (pendingPhotoUrl !== null) {
        patch.photoUrl = pendingPhotoUrl || null;
      }

      await updateProperty.mutateAsync(
        { propertyId: property.id, data: patch },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(property.id) });
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
            toast({ title: t("editProperty.updated") });
            onSaved?.();
            onOpenChange(false);
          },
          onError: () => toast({ title: t("editProperty.couldNotSave"), variant: "destructive" }),
        }
      );
    } finally {
      setSaving(false);
    }
  }

  const currentPhoto = photoPreview;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <SheetTitle className="text-lg">{t("editProperty.title")}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Photo */}
          <div className="space-y-2">
            <Label htmlFor="edit-property-photo" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("editProperty.photoLabel")}</Label>
            <div className="relative group">
              {currentPhoto ? (
                <div className="relative h-44 w-full rounded-xl overflow-hidden border border-border">
                  <img src={currentPhoto} alt={t("addProperty.photoAlt")} className="h-full w-full object-cover" />
                  {uploading && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  {!uploading && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-transparent [@media(hover:none)]:items-end [@media(hover:none)]:pb-3 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/90 hover:bg-white text-foreground rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {t("addProperty.changePhoto")}
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="bg-white/90 hover:bg-white text-destructive rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("common.remove")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-xs font-medium">{t("editProperty.uploadPhoto")}</span>
                    </>
                  )}
                </button>
              )}
              <input
                id="edit-property-photo"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-property-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelPropertyName")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="edit-property-name"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }}
              placeholder={t("onboarding.propertyNamePlaceholder")}
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "edit-property-name-error" : undefined}
            />
            <FieldError id="edit-property-name-error" message={errors.name} />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-property-address" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelStreetAddress")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="edit-property-address"
              value={address}
              onChange={(e) => { setAddress(e.target.value); clearError("address"); }}
              required
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "edit-property-address-error" : undefined}
            />
            <FieldError id="edit-property-address-error" message={errors.address} />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="edit-property-city" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelCity")}</Label>
              <Input id="edit-property-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-property-state" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelState")}</Label>
              <Input id="edit-property-state" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder={t("onboarding.statePlaceholder")} />
            </div>
          </div>

          {/* Zip */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-property-zip-code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelZipCode")}</Label>
            <Input id="edit-property-zip-code" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="78701" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-property-year" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelYearBuilt")}</Label>
              <Input
                id="edit-property-year"
                value={yearBuilt}
                onChange={(e) => { setYearBuilt(e.target.value); clearError("yearBuilt"); }}
                type="number"
                placeholder="1990"
                aria-invalid={!!errors.yearBuilt}
                aria-describedby={errors.yearBuilt ? "edit-property-year-error" : undefined}
              />
              <FieldError id="edit-property-year-error" message={errors.yearBuilt} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-property-sq-ft" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("onboarding.labelSqFt")}</Label>
              <Input id="edit-property-sq-ft" value={sqft} onChange={(e) => setSqft(e.target.value)} type="number" placeholder="2000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-property-bedrooms" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("editProperty.bedrooms")}</Label>
              <Input id="edit-property-bedrooms" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" placeholder="3" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-property-bathrooms" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("editProperty.bathrooms")}</Label>
              <Input id="edit-property-bathrooms" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} type="number" step="0.5" placeholder="2" />
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-end gap-2 shrink-0 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("common.saveChanges")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
