import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";

export function LensStep({
  imageUri, scanBusy, scanError, onCamera, onGallery, onScan, onClearImage, onRetake, onManual, colors,
}: {
  imageUri: string | null; scanBusy: boolean; scanError: string | null;
  onCamera: () => void; onGallery: () => void; onScan: () => void;
  onClearImage: () => void; onRetake: () => void; onManual: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {!imageUri ? (
        <>
          {/* Pick method buttons */}
          <TouchableOpacity onPress={onCamera} style={[s.photoBtn, { backgroundColor: colors.primary, opacity: scanBusy ? 0.6 : 1 }]} activeOpacity={0.85} disabled={scanBusy}>
            <Feather name="camera" size={20} color={colors.primaryForeground} />
            <Text style={[s.photoBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.takeAPhoto")}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onGallery} style={[s.photoBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: scanBusy ? 0.6 : 1 }]} activeOpacity={0.85} disabled={scanBusy}>
            <Feather name="image" size={20} color={colors.foreground} />
            <Text style={[s.photoBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("common.chooseFromLibrary")}</Text>
          </TouchableOpacity>

          <View style={[s.tipBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("addAsset.bestResults")}
            </Text>
          </View>

          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onManual(); }} activeOpacity={0.7}>
            <Text style={[{ textAlign: "center", fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textDecorationLine: "underline" }]}>
              {t("addAsset.skipEnterManually")}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Image preview */}
          <View style={[s.imagePreview, { borderColor: colors.border }]}>
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: 220 }} contentFit="contain" />
            {!scanBusy && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("common.removePhoto")}
                hitSlop={12}
                onPress={onClearImage}
                style={[s.clearBtn, { backgroundColor: colors.background + "ee" }]}
                activeOpacity={0.8}
              >
                <Feather name="x" size={14} color={colors.foreground} />
              </TouchableOpacity>
            )}
            {scanBusy && (
              <View style={s.scanOverlay}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>{t("addAsset.readingPlate")}</Text>
              </View>
            )}
          </View>

          {/* Scan error */}
          {scanError && (
            <View style={[s.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[s.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{scanError}</Text>
            </View>
          )}

          {/* Actions */}
          {!scanBusy && !scanError && (
            <TouchableOpacity onPress={onScan} style={[s.photoBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
              <Feather name="zap" size={18} color={colors.primaryForeground} />
              <Text style={[s.photoBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.scanWithAi")}</Text>
            </TouchableOpacity>
          )}

          {scanError && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={onRetake}
                style={[s.halfBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                activeOpacity={0.7}
              >
                <Text style={[s.halfBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("addAsset.retakePhoto")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onManual(); }}
                style={[s.halfBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.7}
              >
                <Text style={[s.halfBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.enterManually")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
