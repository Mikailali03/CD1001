import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { compressImage, uploadToStorage, PHOTO_MAX_PX, apiErrorMessage } from "@/lib/upload";
import {
  getListPropertiesQueryKey,
  lookupProperty,
  createProperty,
  generateStewardshipPlan,
  type PropertyLookupResult,
  type Property,
} from "@workspace/api-client-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, CheckCircle2, Sparkles, TreePine, ArrowRight, Wand2 } from "lucide-react";
import { AddressStep } from "@/components/add-property/address-step";
import {
  VerifyStep,
  EMPTY_PROPERTY_FORM,
  type PropertyForm,
  type PropertyFormErrors,
} from "@/components/add-property/verify-step";
import { PhotoStep } from "@/components/add-property/photo-step";

type Step = "address" | "verify" | "photo" | "scouting" | "done";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (propertyId: string) => void;
};

/** HTTP status carried by generated-client errors; undefined for network failures. */
function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("address");
  const [addressInput, setAddressInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<PropertyLookupResult | null>(null);

  const [form, setForm] = useState<PropertyForm>(EMPTY_PROPERTY_FORM);
  const setField = (key: keyof PropertyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const [saveBusy, setSaveBusy] = useState(false);
  const [scoutResult, setScoutResult] = useState<{ taskCount: number } | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Photo step state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);

  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const clearError = (key: keyof PropertyFormErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  function reset() {
    setStep("address");
    setAddressInput("");
    setLookupBusy(false);
    setLookupResult(null);
    setForm(EMPTY_PROPERTY_FORM);
    setSaveBusy(false);
    setScoutResult(null);
    setCreatedPropertyId(null);
    setLatitude(null);
    setLongitude(null);
    setPhotoPreview(null);
    setPhotoUploading(false);
    setPendingPhotoUrl(null);
    setErrors({});
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleLookup() {
    if (!addressInput.trim()) {
      setErrors({ addressInput: t("onboarding.errAddressRequired") });
      return;
    }
    setLookupBusy(true);
    try {
      let data: PropertyLookupResult;
      try {
        data = await lookupProperty({ address: addressInput.trim() });
      } catch (err) {
        toast({
          title: t("onboarding.addressNotFound"),
          description: apiErrorMessage(err, t("onboarding.addressNotFoundDesc")),
          variant: "destructive",
        });
        return;
      }
      setLookupResult(data);
      setForm({
        name: data.address,
        address: data.address,
        city: data.city ?? "",
        state: data.state ?? "",
        zipCode: data.zipCode ?? "",
        yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : "",
        sqft: data.sqft != null ? String(data.sqft) : "",
        bedrooms: data.bedrooms != null ? String(data.bedrooms) : "",
        bathrooms: data.bathrooms != null ? String(data.bathrooms) : "",
      });
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
      setStep("verify");
    } finally {
      setLookupBusy(false);
    }
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      setPendingPhotoUrl(await uploadToStorage(await compressImage(file, PHOTO_MAX_PX)));
    } catch (err) {
      toast({ title: t("addProperty.photoUploadFailed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setPhotoPreview(null);
      setPendingPhotoUrl(null);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  function validateDetails() {
    const next: PropertyFormErrors = {};
    if (!form.name.trim()) next.name = t("onboarding.errNameRequired");
    if (!form.address.trim()) next.address = t("onboarding.errStreetRequired");
    const year = form.yearBuilt ? parseInt(form.yearBuilt) : null;
    if (year != null && (year < 1600 || year > new Date().getFullYear() + 1)) next.yearBuilt = t("onboarding.errYearInvalid");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(photoUrl?: string | null) {
    if (!form.name.trim() || !form.address.trim()) return;
    setSaveBusy(true);
    setStep("scouting");

    try {
      // If an earlier attempt already created the property (and failed
      // afterwards), don't POST again — that would create a duplicate.
      if (createdPropertyId) {
        await runScout(createdPropertyId);
        return;
      }

      let property: Property | null;
      try {
        property = await createProperty({
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          zipCode: form.zipCode.trim() || undefined,
          yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
          sqft: form.sqft ? parseInt(form.sqft) : undefined,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
          bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          ...(photoUrl != null ? { photoUrl } : {}),
        });
      } catch (err) {
        const status = errorStatus(err);
        if (status === undefined) throw err;
        if (status >= 200 && status < 300) {
          // Created, but the body couldn't be read (see below).
          property = null;
        } else {
          toast({ title: t("onboarding.couldNotSave"), variant: "destructive" });
          setStep("verify");
          return;
        }
      }

      // The property exists once the POST succeeds. If the body can't be read
      // we don't know its id, so close rather than let a retry duplicate it.
      if (!property?.id) {
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        toast({ title: t("addProperty.savedToast"), description: t("addProperty.savedToastDesc") });
        handleClose(false);
        return;
      }
      setCreatedPropertyId(property.id);

      await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      await runScout(property.id);
    } catch {
      toast({ title: t("common.somethingWentWrong"), variant: "destructive" });
      setStep("verify");
    } finally {
      setSaveBusy(false);
    }
  }

  async function runScout(propertyId: string) {
    try {
      const scoutData = await generateStewardshipPlan(propertyId);
      setScoutResult({ taskCount: scoutData.taskCount });
    } catch (err) {
      // A non-2xx reply leaves the result unset; only a network failure records 0.
      if (errorStatus(err) === undefined) setScoutResult({ taskCount: 0 });
    }

    setStep("done");
    onCreated?.(propertyId);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">

        {/* ── Step 1: Address ── */}
        {step === "address" && (
          <AddressStep
            addressInput={addressInput}
            onAddressChange={(v) => { setAddressInput(v); clearError("addressInput"); }}
            error={errors.addressInput}
            lookupBusy={lookupBusy}
            onLookup={handleLookup}
            onCancel={() => handleClose(false)}
          />
        )}

        {/* ── Step 2: Verify ── */}
        {step === "verify" && (
          <VerifyStep
            form={form}
            setField={setField}
            errors={errors}
            clearError={clearError}
            lookupResult={lookupResult}
            onBack={() => setStep("address")}
            onNext={() => { if (validateDetails()) setStep("photo"); }}
          />
        )}

        {/* ── Step 3: Photo ── */}
        {step === "photo" && (
          <PhotoStep
            photoPreview={photoPreview}
            photoUploading={photoUploading}
            saveBusy={saveBusy}
            onFileChange={handlePhotoFileChange}
            onRemove={() => { setPhotoPreview(null); setPendingPhotoUrl(null); }}
            onBack={() => setStep("verify")}
            onSkip={() => handleSave(null)}
            onSave={() => handleSave(pendingPhotoUrl)}
          />
        )}

        {/* ── Step 4: AI Scouting ── */}
        {step === "scouting" && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-5">
            <div className="relative">
              <div className="bg-primary/10 rounded-full p-5">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">{t("addProperty.scoutingTitle")}</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                {t("onboarding.scoutingSubtitle")}
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2 pt-2">
              {(["scoutStep1", "scoutStep2", "scoutStep3"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  {t(`onboarding.${key}`)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === "done" && (
          <>
            <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
              <div className="bg-emerald-100 rounded-full p-5">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold">{t("onboarding.doneTitle")}</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  {t("onboarding.doneSubtitle")}
                </p>
              </div>

              {scoutResult && scoutResult.taskCount > 0 && (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-800">
                      {t("onboarding.tasksGenerated", { count: scoutResult.taskCount })}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {t("onboarding.tasksGeneratedDesc")}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full text-xs text-muted-foreground">
                {[
                  { icon: <Building2 className="h-3.5 w-3.5" />, text: t("addProperty.checkSaved") },
                  { icon: <Wand2 className="h-3.5 w-3.5" />, text: t("addProperty.checkPlan") },
                  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: t("addProperty.checkStewardship") },
                  { icon: <TreePine className="h-3.5 w-3.5" />, text: t("addProperty.checkSeasonal") },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-emerald-600">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <Button onClick={() => handleClose(false)} className="gap-1.5">
                {t("addProperty.viewDashboard")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
