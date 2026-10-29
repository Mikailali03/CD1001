import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  scanAssetDataPlate,
  createAsset,
  generateAssetMaintenanceTasks,
} from "@workspace/api-client-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/subscription-context";
import { compressForScan, type ScanResult, type Step } from "@/components/add-asset/constants";
import { MethodStep } from "@/components/add-asset/method-step";
import { LensStep } from "@/components/add-asset/lens-step";
import {
  ReviewStep,
  EMPTY_ASSET_FORM,
  type AssetForm,
  type AssetFormErrors,
} from "@/components/add-asset/review-step";
import { GeneratingStep } from "@/components/add-asset/generating-step";
import { DoneStep } from "@/components/add-asset/done-step";

type Props = {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (assetId: string) => void;
};

/** HTTP status carried by generated-client errors (ApiError / ResponseParseError); undefined for network failures. */
function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

function isAssetOrPropertyKey(k: unknown) {
  return typeof k === "string" && (k.includes("assets") || k.includes("properties"));
}

export function AddAssetDialog({ propertyId, open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { subscription, openUpgradeModal } = useSubscription();
  const aiScanLocked = subscription?.tier === "essential" && (subscription?.aiScansUsed ?? 0) >= 1;

  const [step, setStep] = useState<Step>("method");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Editable form fields
  const [form, setForm] = useState<AssetForm>(EMPTY_ASSET_FORM);
  const setField = <K extends keyof AssetForm>(key: K, value: AssetForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [saveBusy, setSaveBusy] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [planBlocked, setPlanBlocked] = useState(false);
  const [errors, setErrors] = useState<AssetFormErrors>({});

  function reset() {
    setStep("method");
    setImageFile(null);
    setImagePreview(null);
    setScanBusy(false);
    setScanResult(null);
    setScanError(null);
    setForm(EMPTY_ASSET_FORM);
    setSaveBusy(false);
    setTaskCount(null);
    setCreatedAssetId(null);
    setPlanBlocked(false);
    setErrors({});
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function applyManual() {
    setStep("review");
  }

  function handleImageSelected(file: File) {
    setImageFile(file);
    setScanError(null);
    setScanResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageFile) return;
    setScanBusy(true);
    setScanError(null);

    try {
      const { base64, mimeType } = await compressForScan(imageFile);

      let data: ScanResult;
      try {
        data = await scanAssetDataPlate({ imageBase64: base64, mimeType });
      } catch (err) {
        if (errorStatus(err) === undefined) throw err;
        setScanError(t("addAsset.scanFailed"));
        return;
      }
      setScanResult(data);

      // Pre-fill form
      const next: Partial<AssetForm> = {};
      if (data.suggestedName) next.name = data.suggestedName;
      else if (data.brand && data.model) next.name = `${data.brand} ${data.model}`;
      else if (data.brand) next.name = data.brand;

      if (data.category) next.category = data.category;
      if (data.brand) next.brand = data.brand;
      if (data.model) next.model = data.model;
      if (data.serialNumber) next.serialNumber = data.serialNumber;
      if (data.manufactureDate) next.installDate = data.manufactureDate.substring(0, 7);
      if (data.estimatedReplacementCost) next.replacementCost = String(data.estimatedReplacementCost);
      setForm((f) => ({ ...f, ...next }));

      setStep("review");
    } catch {
      setScanError(t("addAsset.scanUnreachable"));
    } finally {
      setScanBusy(false);
    }
  }

  function validate() {
    const next: AssetFormErrors = {};
    if (!form.name.trim()) next.name = t("addAsset.nameRequired");
    if (form.replacementCost && parseFloat(form.replacementCost) < 0) next.replacementCost = t("validation.nonNegative");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaveBusy(true);
    setStep("generating");

    try {
      // A previous attempt may have created the asset before failing; reuse
      // it rather than POSTing a duplicate.
      let assetId = createdAssetId;
      if (!assetId) {
        // Create the asset
        let asset: { id?: string } | null;
        try {
          asset = await createAsset(propertyId, {
            name: form.name.trim(),
            category: form.category,
            brand: form.brand.trim() || undefined,
            model: form.model.trim() || undefined,
            serialNumber: form.serialNumber.trim() || undefined,
            installDate: form.installDate || undefined,
            replacementCost: form.replacementCost ? parseFloat(form.replacementCost) : undefined,
            warrantyExpiry: form.warrantyExpiry ? `${form.warrantyExpiry}-01` : undefined,
          });
        } catch (err) {
          const status = errorStatus(err);
          if (status === undefined) throw err;
          if (status >= 200 && status < 300) {
            // Created, but the body couldn't be read (see below).
            asset = null;
          } else {
            toast({ title: t("addAsset.couldNotSave"), variant: "destructive" });
            setStep("review");
            return;
          }
        }

        // The asset exists once the POST succeeds. If the body can't be read
        // we don't know its id, so close rather than let a retry duplicate it.
        if (!asset?.id) {
          await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some(isAssetOrPropertyKey) });
          toast({ title: t("addAsset.savedToast"), description: t("addAsset.savedToastDesc") });
          handleClose(false);
          return;
        }
        assetId = asset.id;
        setCreatedAssetId(assetId);

        // Invalidate asset lists
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some(isAssetOrPropertyKey) });
      }

      // Trigger autonomous task generation
      try {
        const td = await generateAssetMaintenanceTasks(assetId);
        setTaskCount(td.taskCount);
      } catch (err) {
        if (errorStatus(err) === 403) setPlanBlocked(true);
        setTaskCount(0);
      }

      // Invalidate again after tasks generated
      await queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey.some(
            (k) => isAssetOrPropertyKey(k) || (typeof k === "string" && (k.includes("maintenance") || k.includes("summary"))),
          ),
      });

      setStep("done");
      onCreated?.(assetId);
    } catch {
      toast({ title: t("common.somethingWentWrong"), variant: "destructive" });
      setStep("review");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {step === "method" && (
          <MethodStep
            aiScanLocked={aiScanLocked}
            onUpgrade={() => openUpgradeModal()}
            onLens={() => setStep("lens")}
            onManual={applyManual}
            onCancel={() => handleClose(false)}
          />
        )}

        {step === "lens" && (
          <LensStep
            imagePreview={imagePreview}
            scanBusy={scanBusy}
            scanError={scanError}
            onFile={handleImageSelected}
            onRemovePhoto={() => { setImageFile(null); setImagePreview(null); setScanResult(null); setScanError(null); }}
            onRetake={() => { setImageFile(null); setImagePreview(null); setScanError(null); }}
            onScan={handleScan}
            onManual={applyManual}
            onBack={() => setStep("method")}
          />
        )}

        {step === "review" && (
          <ReviewStep
            form={form}
            setField={setField}
            errors={errors}
            clearError={(key) => setErrors((p) => ({ ...p, [key]: undefined }))}
            scanResult={scanResult}
            saveBusy={saveBusy}
            onBack={() => setStep(imagePreview ? "lens" : "method")}
            onSave={handleSave}
          />
        )}

        {step === "generating" && (
          <GeneratingStep brand={form.brand} model={form.model} onClose={() => handleClose(false)} />
        )}

        {step === "done" && (
          <DoneStep
            name={form.name}
            taskCount={taskCount}
            planBlocked={planBlocked}
            onUpgrade={openUpgradeModal}
            onAddAnother={reset}
            onView={() => handleClose(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
