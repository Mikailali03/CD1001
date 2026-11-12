import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUnclaimedHistory,
  getGetUnclaimedHistoryQueryKey,
  createOwnershipClaim,
  type CreateOwnershipClaimBodyDocumentType,
} from "@workspace/api-client-react";
import { uploadFailureMessage, useImageUpload } from "@/hooks/useImageUpload";
import { useColors } from "@/hooks/useColors";

// Offers a new owner the history a previous owner left at this address and
// collects a photo of their closing document or ID for review. The endpoint is
// owner-only, so collaborators get a 404 and see nothing.
export function UnclaimedHistoryBanner({ propertyId, colors }: {
  propertyId: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { upload, isUploading } = useImageUpload();
  const { data } = useGetUnclaimedHistory(propertyId, {
    query: { queryKey: getGetUnclaimedHistoryQueryKey(propertyId), retry: false },
  });
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<CreateOwnershipClaimBodyDocumentType>("closing_document");
  const [submitting, setSubmitting] = useState(false);
  const busy = isUploading || submitting;

  if (!data) return null;
  const claim = data.claim;

  if (claim?.status === "pending") {
    return (
      <View style={[styles.banner, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
        <Feather name="clock" size={16} color="#2563eb" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("ownershipClaim.pendingTitle")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("ownershipClaim.pendingBody")}</Text>
        </View>
      </View>
    );
  }
  if (!data.available) return null;

  async function pickAndSubmit(source: "camera" | "library") {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("common.permissionNeeded"), t(source === "camera" ? "common.cameraPermission" : "common.libraryPermission"));
      return;
    }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;

    setSubmitting(true);
    try {
      const uploaded = await upload(result.assets[0]);
      await createOwnershipClaim(propertyId, { documentType, documentPath: uploaded.objectPath });
      setOpen(false);
      Alert.alert(t("ownershipClaim.submitted"));
      queryClient.invalidateQueries({ queryKey: getGetUnclaimedHistoryQueryKey(propertyId) });
    } catch (err) {
      Alert.alert(t("ownershipClaim.submitFailed"), uploadFailureMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const option = (value: CreateOwnershipClaimBodyDocumentType, label: string, hint: string) => {
    const selected = documentType === value;
    return (
      <TouchableOpacity
        onPress={() => setDocumentType(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[styles.option, { borderColor: selected ? colors.primary : colors.border }]}
        activeOpacity={0.7}
      >
        <Feather name={selected ? "check-circle" : "circle"} size={18} color={selected ? colors.primary : colors.mutedForeground} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{hint}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.banner, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
        <Feather name="clock" size={16} color="#047857" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("ownershipClaim.foundTitle")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("ownershipClaim.foundBody", { assets: data.assetCount, records: data.recordCount, verified: data.verifiedCount })}
          </Text>
          {claim?.status === "rejected" ? (
            <Text style={[styles.body, { color: "#dc2626", marginTop: 4 }]}>
              {t("ownershipClaim.rejected", { reason: claim.rejectionReason ?? "" })}
            </Text>
          ) : null}
          <TouchableOpacity onPress={() => setOpen(true)} style={[styles.cta, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t("ownershipClaim.claimCta")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("ownershipClaim.dialogTitle")}</Text>
            <TouchableOpacity onPress={() => !busy && setOpen(false)} hitSlop={10} accessibilityLabel={t("common.cancel")}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.body, { color: colors.mutedForeground, marginBottom: 16 }]}>{t("ownershipClaim.dialogBody")}</Text>

          {option("closing_document", t("ownershipClaim.closingDocument"), t("ownershipClaim.closingDocumentHint"))}
          {option("photo_id", t("ownershipClaim.photoId"), t("ownershipClaim.photoIdHint"))}

          <Text style={[styles.body, { color: colors.mutedForeground, marginVertical: 12 }]}>{t("ownershipClaim.privacyNote")}</Text>

          {busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <View style={{ gap: 8 }}>
              <TouchableOpacity onPress={() => pickAndSubmit("camera")} style={[styles.cta, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t("ownershipClaim.takePhoto")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => pickAndSubmit("library")} style={[styles.cta, { borderWidth: 1, borderColor: colors.border }]} activeOpacity={0.85}>
                <Text style={[styles.ctaText, { color: colors.foreground }]}>{t("ownershipClaim.choosePhoto")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", marginTop: 2 },
  cta: { borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  ctaText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sheet: { flex: 1, padding: 20 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  option: { flexDirection: "row", gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10 },
});
