import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { s } from "./styles";

export function MethodStep({
  onLens, onManual, colors,
}: {
  onLens: () => void; onManual: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
      {/* AI Lens card */}
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); onLens(); }}
        style={[s.methodCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "35", borderWidth: 2 }]}
        activeOpacity={0.8}
      >
        <View style={[s.methodIcon, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="camera" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={[s.methodTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiLens")}</Text>
            <View style={[s.recBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[s.recBadgeText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{t("addAsset.recommended")}</Text>
            </View>
          </View>
          <Text style={[s.methodDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("addAsset.aiLensDesc")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {[t("addAsset.perkAutofill"), t("addAsset.perkAnyLabel"), t("addAsset.perkEstimate")].map((perk) => (
              <View key={perk} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="check-circle" size={11} color={colors.primary} />
                <Text style={[s.featureTip, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>{perk}</Text>
              </View>
            ))}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.primary} />
      </TouchableOpacity>

      {/* Manual entry card */}
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); onManual(); }}
        style={[s.methodCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
        activeOpacity={0.8}
      >
        <View style={[s.methodIcon, { backgroundColor: colors.muted }]}>
          <Feather name="edit-2" size={24} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.methodTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 4 }]}>{t("addAsset.enterManually")}</Text>
          <Text style={[s.methodDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("addAsset.enterManuallyDesc")}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={[s.footNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {t("addAsset.methodFootnote")}
      </Text>
    </ScrollView>
  );
}
