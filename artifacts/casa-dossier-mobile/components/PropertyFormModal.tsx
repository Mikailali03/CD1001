import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  useCreateProperty,
  useUpdateProperty,
  getListPropertiesQueryKey,
  getGetPropertyQueryKey,
  type Property,
  type PropertyLookupResult,
  type UpdatePropertyBody,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AddressSearchField } from "@/components/property-form/AddressSearchField";
import { PropertyDetailsFields } from "@/components/property-form/PropertyDetailsFields";
import { PropertyPhotoField } from "@/components/property-form/PropertyPhotoField";
import { fStyles } from "@/components/property-form/styles";
import { resolveStorageUrl, storageUrlForObjectPath } from "@/lib/config";
import { uploadFailureMessage, useImageUpload } from "@/hooks/useImageUpload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormState {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  yearBuilt: string;
  sqft: string;
}

const BLANK_FORM: FormState = {
  name: "", address: "", city: "", state: "", zipCode: "", yearBuilt: "", sqft: "",
};

export interface PropertyFormModalProps {
  mode: "add" | "edit";
  property?: Property | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyFormModal({ mode, property, visible, onClose, colors, insets }: PropertyFormModalProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const { upload, isUploading: photoUploading } = useImageUpload();

  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Populate form when opening for edit
  useEffect(() => {
    if (visible) {
      if (mode === "edit" && property) {
        const p = property;
        setForm({
          name: p.name ?? "",
          address: p.address ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          zipCode: p.zipCode ?? "",
          yearBuilt: p.yearBuilt != null ? String(p.yearBuilt) : "",
          sqft: p.sqft != null ? String(p.sqft) : "",
        });
        setPhotoUri(resolveStorageUrl(p.photoUrl) ?? null);
        setPhotoUrl(p.photoUrl ?? null);
      } else {
        setForm(BLANK_FORM);
        setPhotoUri(null);
        setPhotoUrl(null);
      }
      setSaving(false);
    }
  }, [visible, mode, property?.id]);

  function applyLookup(data: PropertyLookupResult) {
    setForm((prev) => ({
      name: prev.name || data.address,
      address: data.address,
      city: data.city ?? prev.city,
      state: data.state ?? prev.state,
      zipCode: data.zipCode ?? prev.zipCode,
      yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : prev.yearBuilt,
      sqft: data.sqft != null ? String(data.sqft) : prev.sqft,
    }));
  }

  async function uploadPickedAsset(asset: ImagePicker.ImagePickerAsset) {
    setPhotoUri(asset.uri);
    setPhotoUrl(null);
    try {
      const { objectPath } = await upload(asset);
      setPhotoUrl(storageUrlForObjectPath(objectPath));
    } catch (err) {
      Alert.alert(t("common.uploadFailed"), uploadFailureMessage(err));
      setPhotoUri(null);
      setPhotoUrl(null);
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("propertyForm.permissionRequired"), t("propertyForm.libraryPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("propertyForm.permissionRequired"), t("propertyForm.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedAsset(result.assets[0]);
  }

  function pickPhoto() {
    Alert.alert(
      t("propertyForm.addPhotoTitle"),
      t("propertyForm.addPhotoMessage"),
      [
        { text: t("common.chooseFromLibrary"), onPress: pickFromLibrary },
        { text: t("common.takePhoto"), onPress: takePhoto },
        { text: t("common.cancel"), style: "cancel" },
      ],
    );
  }

  function removePhoto() {
    setPhotoUri(null);
    setPhotoUrl(null);
  }

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) {
      Alert.alert(t("propertyForm.requiredTitle"), t("propertyForm.requiredMessage"));
      return;
    }
    if (photoUploading) {
      Alert.alert(t("common.pleaseWait"), t("common.photoStillUploading"));
      return;
    }
    setSaving(true);
    try {
      const yearBuiltNum = form.yearBuilt ? parseInt(form.yearBuilt, 10) : NaN;
      const sqftNum = form.sqft ? parseInt(form.sqft, 10) : NaN;

      if (mode === "add") {
        const createData = {
          name: form.name.trim(),
          address: form.address.trim(),
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.state.trim() ? { state: form.state.trim() } : {}),
          ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
          ...(!isNaN(yearBuiltNum) && yearBuiltNum > 0 ? { yearBuilt: yearBuiltNum } : {}),
          ...(!isNaN(sqftNum) && sqftNum > 0 ? { sqft: sqftNum } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        };
        await createProperty.mutateAsync({ data: createData });
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      } else if (mode === "edit" && property?.id) {
        const updateData: UpdatePropertyBody = {
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zipCode: form.zipCode.trim() || null,
          yearBuilt: !isNaN(yearBuiltNum) && yearBuiltNum > 0 ? yearBuiltNum : null,
          sqft: !isNaN(sqftNum) && sqftNum > 0 ? sqftNum : null,
          photoUrl: photoUrl ?? null,
        };
        await updateProperty.mutateAsync({ propertyId: property.id, data: updateData });
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(property.id) });
      }
      onClose();
    } catch {
      Alert.alert(t("common.error"), mode === "add" ? t("propertyForm.saveFailed") : t("propertyForm.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={fStyles.kvContainer}
        >
          <View style={[fStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
            {/* Handle */}
            <View style={[fStyles.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={[fStyles.header, { borderBottomColor: colors.border }]}>
              <View style={[fStyles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="home" size={16} color={colors.primary} />
              </View>
              <Text style={[fStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {mode === "add" ? t("common.addProperty") : t("propertyForm.editTitle")}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={[fStyles.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Remounts on each open so the search starts empty */}
              <AddressSearchField key={visible ? "open" : "closed"} onFilled={applyLookup} colors={colors} />

              <PropertyDetailsFields form={form} set={set} colors={colors} />

              <PropertyPhotoField
                photoUri={photoUri}
                uploading={photoUploading}
                onPick={pickPhoto}
                onRemove={removePhoto}
                colors={colors}
              />
            </ScrollView>

            {/* Footer */}
            <View style={[fStyles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={onClose}
                style={[fStyles.cancelBtn, { backgroundColor: colors.muted }]}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Text style={[fStyles.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[fStyles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={[fStyles.saveText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {mode === "add" ? t("common.addProperty") : t("common.saveChanges")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
