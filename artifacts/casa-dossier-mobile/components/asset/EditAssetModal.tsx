import React, { useState } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { updateAsset, type UpdateAssetBody } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";
import { resolveStorageUrl, storageUrlForObjectPath } from "@/lib/config";
import { uploadFailureMessage, useImageUpload } from "@/hooks/useImageUpload";
import type { Asset } from "./types";

// ── Edit Asset Modal ────────────────────────────────────────────────────────────
const EDIT_CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
type EditCategory = typeof EDIT_CATEGORIES[number];
const EDIT_CATEGORY_EMOJIS: Record<EditCategory, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡",
  Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

export function EditAssetModal({
  asset, visible, onClose, onSaved, colors,
}: {
  asset: Asset | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const { upload, isUploading: photoUploading } = useImageUpload();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EditCategory>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [retireConfirm, setRetireConfirm] = useState(false);

  // Photo upload state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const isRetired = !!asset?.retiredAt;

  // Populate form whenever asset changes
  React.useEffect(() => {
    if (!asset) return;
    setName(asset.name ?? "");
    setCategory((asset.category as EditCategory) ?? "HVAC");
    setBrand(asset.brand ?? "");
    setModel(asset.model ?? "");
    setSerialNumber(asset.serialNumber ?? "");
    setInstallDate(asset.installDate ? asset.installDate.substring(0, 7) : "");
    setReplacementCost(asset.replacementCost != null ? String(Number(asset.replacementCost)) : "");
    setWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 7) : "");
    setNotes(asset.notes ?? "");
    setPhotoUri(resolveStorageUrl(asset.photoUrl) ?? null);
    setPhotoUrl(asset.photoUrl ?? null);
  }, [asset?.id, visible]);

  async function uploadEditAsset(picked: ImagePicker.ImagePickerAsset) {
    setPhotoUri(picked.uri);
    setPhotoUrl(null);
    try {
      const { objectPath } = await upload(picked);
      setPhotoUrl(storageUrlForObjectPath(objectPath));
    } catch (err) {
      Alert.alert(t("common.uploadFailed"), uploadFailureMessage(err));
      setPhotoUri(null);
      setPhotoUrl(null);
    }
  }

  async function takeEditPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("common.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadEditAsset(result.assets[0]);
  }

  async function pickEditPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.permissionNeeded"), t("common.libraryPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadEditAsset(result.assets[0]);
  }

  async function patch(body: UpdateAssetBody) {
    if (!asset) return false;
    setBusy(true);
    try {
      await updateAsset(asset.id, body);
      return true;
    } catch {
      Alert.alert(t("common.error"), t("editAsset.saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert(t("addAsset.nameRequiredTitle"), t("addAsset.nameRequiredMessage")); return; }
    if (photoUploading) {
      Alert.alert(t("common.pleaseWait"), t("common.photoStillUploading"));
      return;
    }
    const ok = await patch({
      name: name.trim(),
      category,
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      installDate: installDate ? `${installDate}-01` : undefined,
      replacementCost: replacementCost ? parseFloat(replacementCost) : undefined,
      warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : undefined,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl ?? null,
    });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  async function handleRetire() {
    const ok = await patch({ retiredAt: new Date().toISOString() });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  async function handleRestore() {
    const ok = await patch({ retiredAt: null });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    }
  }

  if (!asset) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[editStyles.root, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[editStyles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[editStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {EDIT_CATEGORY_EMOJIS[category]} {isRetired ? t("editAsset.titleRetired") : t("editAsset.title")}
              </Text>
              <Text style={[editStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {isRetired
                  ? t("editAsset.subtitleRetired")
                  : t("editAsset.subtitle")}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={editStyles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Retired banner */}
          {isRetired && (
            <View style={[editStyles.retiredBanner, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Feather name="archive" size={14} color="#d97706" />
              <Text style={[editStyles.retiredText, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
                {t("editAsset.retiredNotice")}
              </Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            contentContainerStyle={[editStyles.body, { paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("addAsset.nameLabel")} <Text style={{ color: colors.destructive }}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("addAsset.namePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Category */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.categoryLabel")}</Text>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setCategoryOpen((o) => !o); }}
                style={[editStyles.input, editStyles.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15 }}>{EDIT_CATEGORY_EMOJIS[category]}</Text>
                <Text style={[editStyles.pickerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{t(`categories.${category}`, { defaultValue: category })}</Text>
                <Feather name={categoryOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {categoryOpen && (
                <View style={[editStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {EDIT_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ selected: c === category }}
                      key={c}
                      onPress={() => { Haptics.selectionAsync(); setCategory(c); setCategoryOpen(false); }}
                      style={[editStyles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: c === category ? colors.primary + "12" : "transparent" }]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>{EDIT_CATEGORY_EMOJIS[c]}</Text>
                      <Text style={[editStyles.dropdownText, { color: colors.foreground, fontFamily: c === category ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{t(`categories.${c}`, { defaultValue: c })}</Text>
                      {c === category && <Feather name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Brand + Model */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("editAsset.brand")}</Text>
                <TextInput
                  value={brand}
                  onChangeText={setBrand}
                  placeholder={t("addAsset.brandPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.modelLabel")}</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder={t("addAsset.modelPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Serial Number */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.serialLabel")}</Text>
              <TextInput
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder={t("editAsset.serialPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Install Date + Replacement Cost */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.installDateLabel")}</Text>
                <TextInput
                  value={installDate}
                  onChangeText={setInstallDate}
                  placeholder={t("addAsset.monthPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
              <View style={[editStyles.field, { flex: 1 }]}>
                <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.costLabel")}</Text>
                <TextInput
                  value={replacementCost}
                  onChangeText={setReplacementCost}
                  placeholder={t("addAsset.costPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            </View>

            {/* Warranty */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("editAsset.warrantyOptional")}</Text>
              <TextInput
                value={warrantyExpiry}
                onChangeText={setWarrantyExpiry}
                placeholder={t("addAsset.monthPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
                style={[editStyles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Notes */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("editAsset.notes")}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("editAsset.notesPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[editStyles.input, editStyles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Photo */}
            <View style={editStyles.field}>
              <Text style={[editStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.photoOptional")}</Text>
              {photoUri ? (
                <View style={[editStyles.photoPreview, { borderColor: colors.border }]}>
                  <Image source={{ uri: photoUri }} style={{ width: "100%", height: 160 }} contentFit="cover" />
                  {photoUploading && (
                    <View style={editStyles.photoOverlay}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[{ color: "#fff", fontFamily: "Inter_500Medium", fontSize: 12 }]}>{t("common.uploading")}</Text>
                    </View>
                  )}
                  {!photoUploading && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t("common.removePhoto")}
                      hitSlop={12}
                      onPress={() => { setPhotoUri(null); setPhotoUrl(null); }}
                      style={editStyles.photoClearBtn}
                      activeOpacity={0.8}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={takeEditPhoto}
                    style={[editStyles.photoPickerBtn, { flex: 1, borderColor: colors.primary + "60", backgroundColor: colors.primary + "08" }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="camera" size={16} color={colors.primary} />
                    <Text style={[{ fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                      {t("common.takePhoto")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickEditPhoto}
                    style={[editStyles.photoPickerBtn, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="image" size={16} color={colors.mutedForeground} />
                    <Text style={[{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t("common.chooseFromLibrary")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={[editStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={!name.trim() || busy}
              style={[editStyles.saveBtn, { backgroundColor: colors.primary, opacity: (!name.trim() || busy) ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <><Feather name="save" size={16} color={colors.primaryForeground} /><Text style={[editStyles.saveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>{t("common.saveChanges")}</Text></>
              }
            </TouchableOpacity>

            {/* Retire / Restore */}
            {!retireConfirm ? (
              isRetired ? (
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={busy}
                  style={[editStyles.retireBtn, { borderColor: "#3d7a5f50", backgroundColor: "#f0fdf4" }]}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={14} color="#3d7a5f" />
                  <Text style={[editStyles.retireBtnText, { color: "#3d7a5f", fontFamily: "Inter_500Medium" }]}>{t("editAsset.restoreCta")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setRetireConfirm(true)}
                  disabled={busy}
                  style={[editStyles.retireBtn, { borderColor: colors.border, backgroundColor: "transparent" }]}
                  activeOpacity={0.7}
                >
                  <Feather name="archive" size={14} color={colors.mutedForeground} />
                  <Text style={[editStyles.retireBtnText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("editAsset.retireCta")}</Text>
                </TouchableOpacity>
              )
            ) : (
              <View style={[editStyles.confirmBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_600SemiBold", marginBottom: 4 }]}>
                  {t("editAsset.retireConfirmTitle", { name: asset.name })}
                </Text>
                <Text style={[{ fontSize: 12, color: "#92400e", fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 10 }]}>
                  {t("editAsset.retireConfirmBody")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setRetireConfirm(false)}
                    style={[editStyles.confirmCancel, { borderColor: "#fde68a" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 13, color: "#92400e", fontFamily: "Inter_500Medium" }]}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRetire}
                    disabled={busy}
                    style={editStyles.confirmRetire}
                    activeOpacity={0.85}
                  >
                    <Feather name="archive" size={13} color="#fff" />
                    <Text style={[{ fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" }]}>{t("editAsset.retireConfirm")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 17 },
  sub: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4, marginTop: 2 },
  retiredBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  retiredText: { fontSize: 12, flex: 1, lineHeight: 17 },
  body: { padding: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { flex: 1, fontSize: 14 },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginTop: 4 },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownText: { flex: 1, fontSize: 14 },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  saveBtnText: { fontSize: 15 },
  photoPreview: { borderRadius: 10, borderWidth: 1, overflow: "hidden", position: "relative" },
  photoOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", gap: 6 },
  photoClearBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  photoPickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", paddingVertical: 14 },
  retireBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 11 },
  retireBtnText: { fontSize: 13 },
  confirmBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  confirmCancel: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  confirmRetire: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: "#d97706" },
});
