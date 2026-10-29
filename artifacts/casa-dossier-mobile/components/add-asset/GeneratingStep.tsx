import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";

export function GeneratingStep({
  status, assetName, bottomInset, onClose, colors,
}: {
  status: string; assetName: string; bottomInset: number; onClose: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, paddingHorizontal: 32 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
        <View style={[s.genIconWrap, { backgroundColor: colors.primary + "15" }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={[{ fontSize: 18, color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
            {status}
          </Text>
          <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 }]}>
            {assetName
              ? t("addAsset.generatingDescNamed", { name: assetName })
              : t("addAsset.generatingDescGeneric")}
          </Text>
        </View>
        <View style={[s.genBullets, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "check-circle" as const, text: t("addAsset.genStepSaved") },
            { icon: "cpu" as const, text: t("addAsset.genStepAnalyzing") },
            { icon: "calendar" as const, text: t("addAsset.genStepScheduling") },
          ].map(({ icon, text }) => (
            <View key={text} style={s.genBulletRow}>
              <Feather name={icon} size={14} color={colors.primary} />
              <Text style={[{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingBottom: bottomInset + 16, alignItems: "center", gap: 6 }}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); onClose(); }}
          activeOpacity={0.7}
          style={{ paddingVertical: 10, paddingHorizontal: 20 }}
        >
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("addAsset.closeCheckLater")}
          </Text>
        </TouchableOpacity>
        <Text style={[{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
          {t("addAsset.finishesInBackground")}
        </Text>
      </View>
    </View>
  );
}
