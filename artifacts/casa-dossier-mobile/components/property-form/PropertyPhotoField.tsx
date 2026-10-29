import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { fStyles } from "./styles";

// ── Property photo: preview with change/remove, or an add placeholder ─────────
export function PropertyPhotoField({
  photoUri, uploading, onPick, onRemove, colors,
}: {
  photoUri: string | null; uploading: boolean; onPick: () => void; onRemove: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={fStyles.field}>
      <Text style={[fStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{t("propertyForm.photoLabel")}</Text>
      {photoUri ? (
        <View style={fStyles.photoPreviewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={fStyles.photoPreview}
            resizeMode="cover"
          />
          {uploading && (
            <View style={fStyles.photoOverlay}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={fStyles.photoOverlayText}>{t("common.uploading")}</Text>
            </View>
          )}
          {!uploading && (
            <View style={fStyles.photoActions}>
              <TouchableOpacity
                onPress={onPick}
                style={fStyles.photoActionBtn}
                activeOpacity={0.8}
              >
                <Feather name="camera" size={13} color={colors.foreground} />
                <Text style={[fStyles.photoActionText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("propertyForm.changePhoto")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRemove}
                style={[fStyles.photoActionBtn, { backgroundColor: "#fee2e2" }]}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={13} color="#ef4444" />
                <Text style={[fStyles.photoActionText, { color: "#ef4444", fontFamily: "Inter_500Medium" }]}>{t("common.remove")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          style={[fStyles.photoPlaceholder, { borderColor: colors.border, backgroundColor: colors.muted + "40" }]}
          activeOpacity={0.7}
        >
          <Feather name="image" size={24} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
          <Text style={[fStyles.photoPlaceholderText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("propertyForm.tapToAddPhoto")}
          </Text>
          <Text style={[fStyles.photoPlaceholderSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("propertyForm.photoOptionalHint")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
