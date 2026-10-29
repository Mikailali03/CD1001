import React, { useState } from "react";
import { Platform, Alert, KeyboardAvoidingView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  createAsset,
  generateAssetMaintenanceTasks,
  getListMaintenanceTasksQueryKey,
  scanAssetDataPlate,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";
import { storageUrlForObjectPath } from "@/lib/config";
import { isApiError } from "@/lib/api-errors";
import { invalidatePropertyAndList } from "@/lib/query-invalidation";
import { uploadFailureMessage, useImageUpload } from "@/hooks/useImageUpload";
import { AddAssetHeader } from "@/components/add-asset/AddAssetHeader";
import { DoneStep } from "@/components/add-asset/DoneStep";
import { GeneratingStep } from "@/components/add-asset/GeneratingStep";
import { LensStep } from "@/components/add-asset/LensStep";
import { MethodStep } from "@/components/add-asset/MethodStep";
import { ReviewStep } from "@/components/add-asset/ReviewStep";
import { BLANK_FORM, type AssetForm, type ScanResult, type Step } from "@/components/add-asset/types";

export default function AddAssetScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [step, setStep] = useState<Step>("method");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [form, setForm] = useState<AssetForm>(BLANK_FORM);
  const setField = <K extends keyof AssetForm>(key: K, value: AssetForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [saveBusy, setSaveBusy] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState<"creating" | "planning">("creating");
  const [planBlocked, setPlanBlocked] = useState(false);

  // Photo upload state (separate from AI-scan image)
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { upload, isUploading: photoUploading } = useImageUpload();

  function reset() {
    setStep("method"); setImageUri(null); setImageBase64(null);
    setScanBusy(false); setScanResult(null); setScanError(null); setPlanBlocked(false);
    setForm(BLANK_FORM);
    setSaveBusy(false); setTaskCount(null); setCreatedAssetId(null);
    setGeneratingStatus("creating");
    setPhotoUri(null); setPhotoUrl(null);
  }

  async function uploadPickedAsset(pickedAsset: ImagePicker.ImagePickerAsset) {
    setPhotoUri(pickedAsset.uri);
    setPhotoUrl(null);
    try {
      const { objectPath } = await upload(pickedAsset);
      setPhotoUrl(storageUrlForObjectPath(objectPath));
    } catch (err) {
      Alert.alert(t("common.uploadFailed"), uploadFailureMessage(err));
      setPhotoUri(null);
      setPhotoUrl(null);
    }
  }

  async function takeAssetPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("common.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  async function pickAssetPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("common.libraryPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("common.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images", base64: true, quality: 0.82, allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setScanError(null); setScanResult(null);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("addAsset.libraryPermissionPick"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", base64: true, quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setScanError(null); setScanResult(null);
    }
  }

  async function handleScan() {
    if (!imageBase64) return;
    setScanBusy(true); setScanError(null);
    try {
      let data: ScanResult;
      try {
        data = await scanAssetDataPlate({ imageBase64, mimeType: "image/jpeg" });
      } catch (err) {
        if (!isApiError(err)) throw err;
        setScanError(t("addAsset.scanFailed"));
        return;
      }
      setScanResult(data);
      setForm((prev) => ({
        ...prev,
        name: data.suggestedName
          || (data.brand && data.model ? `${data.brand} ${data.model}` : data.brand)
          || prev.name,
        category: data.category ?? prev.category,
        brand: data.brand || prev.brand,
        model: data.model || prev.model,
        serialNumber: data.serialNumber || prev.serialNumber,
        installDate: data.manufactureDate ? data.manufactureDate.substring(0, 7) : prev.installDate,
        replacementCost: data.estimatedReplacementCost ? String(data.estimatedReplacementCost) : prev.replacementCost,
      }));
      setStep("review");
    } catch {
      setScanError(t("addAsset.scanUnreachable"));
    } finally {
      setScanBusy(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert(t("addAsset.nameRequiredTitle"), t("addAsset.nameRequiredMessage")); return; }
    if (!propertyId) { Alert.alert(t("common.error"), t("addAsset.noPropertySelected")); return; }
    if (photoUploading) {
      Alert.alert(t("common.pleaseWait"), t("common.photoStillUploading"));
      return;
    }
    setSaveBusy(true);
    setStep("generating");
    setGeneratingStatus("creating");

    try {
      let assetId: string;
      try {
        const asset = await createAsset(propertyId, {
          name: form.name.trim(),
          category: form.category,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
          installDate: form.installDate ? `${form.installDate}-01` : undefined,
          replacementCost: form.replacementCost ? parseFloat(form.replacementCost) : undefined,
          warrantyExpiry: form.warrantyExpiry ? `${form.warrantyExpiry}-01` : undefined,
          ...(photoUrl ? { photoUrl } : {}),
        });
        assetId = asset.id;
      } catch (err) {
        if (!isApiError(err)) throw err;
        Alert.alert(t("common.error"), t("addAsset.couldNotSave"));
        setStep("review");
        return;
      }
      setCreatedAssetId(assetId);

      await invalidatePropertyAndList(qc, propertyId);

      setGeneratingStatus("planning");

      try {
        const td = await generateAssetMaintenanceTasks(assetId);
        setTaskCount(td.taskCount ?? 0);
      } catch (err) {
        // 403: the free plan's AI plan allowance is used up
        if (isApiError(err) && err.status === 403) setPlanBlocked(true);
        setTaskCount(0);
      }

      await Promise.all([
        invalidatePropertyAndList(qc, propertyId),
        qc.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) }),
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } catch {
      Alert.alert(t("common.error"), t("common.somethingWentWrong"));
      setStep("review");
    } finally {
      setSaveBusy(false);
    }
  }

  function handleBack() {
    if (step === "method") { router.back(); }
    else if (step === "lens") setStep("method");
    else if (step === "review") setStep(imageUri ? "lens" : "method");
  }

  const fieldsFilled = [form.brand, form.model, form.serialNumber].filter(Boolean).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <AddAssetHeader
        step={step}
        scanResult={scanResult}
        fieldsFilled={fieldsFilled}
        taskCount={taskCount}
        topPad={topPad}
        onBack={handleBack}
        colors={colors}
      />

      {step === "method" && (
        <MethodStep onLens={() => setStep("lens")} onManual={() => setStep("review")} colors={colors} />
      )}

      {step === "lens" && (
        <LensStep
          imageUri={imageUri}
          scanBusy={scanBusy}
          scanError={scanError}
          onCamera={pickFromCamera}
          onGallery={pickFromGallery}
          onScan={handleScan}
          onClearImage={() => { setImageUri(null); setImageBase64(null); setScanResult(null); setScanError(null); }}
          onRetake={() => { setImageUri(null); setImageBase64(null); setScanError(null); }}
          onManual={() => setStep("review")}
          colors={colors}
        />
      )}

      {step === "review" && (
        <ReviewStep
          form={form}
          setField={setField}
          scanResult={scanResult}
          fieldsFilled={fieldsFilled}
          saveBusy={saveBusy}
          onSave={handleSave}
          photoUri={photoUri}
          photoUploading={photoUploading}
          onTakePhoto={takeAssetPhoto}
          onPickPhoto={pickAssetPhoto}
          onRemovePhoto={() => { setPhotoUri(null); setPhotoUrl(null); }}
          bottomInset={insets.bottom}
          colors={colors}
        />
      )}

      {step === "generating" && (
        <GeneratingStep
          status={generatingStatus === "creating" ? t("addAsset.statusCreating") : t("addAsset.statusPlanning")}
          assetName={form.name}
          bottomInset={insets.bottom}
          onClose={() => router.back()}
          colors={colors}
        />
      )}

      {step === "done" && (
        <DoneStep
          assetName={form.name}
          planBlocked={planBlocked}
          taskCount={taskCount}
          onView={() => {
            if (createdAssetId) router.replace(`/asset/${createdAssetId}`);
            else router.back();
          }}
          onAddAnother={reset}
          onDone={() => router.back()}
          colors={colors}
        />
      )}
    </KeyboardAvoidingView>
  );
}
