import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";

// ── Optional asset photo: preview with upload state, or camera/library buttons ─
export function AssetPhotoField({
  photoUri, uploading, onTake, onPick, onRemove, colors,
}: {
  photoUri: string | null; uploading: boolean;
  onTake: () => void; onPick: () => void; onRemove: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.photoOptional")}</Text>
      {photoUri ? (
        <View style={[s.imagePreview, { borderColor: colors.border }]}>
          <Image source={{ uri: photoUri }} style={{ width: "100%", height: 160 }} contentFit="cover" />
          {uploading && (
            <View style={s.scanOverlay}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }]}>{t("common.uploading")}</Text>
            </View>
          )}
          {!uploading && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.removePhoto")}
              hitSlop={12}
              onPress={onRemove}
              style={[s.clearBtn, { backgroundColor: colors.background + "ee" }]}
              activeOpacity={0.8}
            >
              <Feather name="x" size={14} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={onTake}
            style={[s.photoPickerBtn, { flex: 1, borderColor: colors.primary + "60", backgroundColor: colors.primary + "08" }]}
            activeOpacity={0.7}
          >
            <Feather name="camera" size={16} color={colors.primary} />
            <Text style={[{ fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {t("common.takePhoto")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPick}
            style={[s.photoPickerBtn, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}
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
  );
}
