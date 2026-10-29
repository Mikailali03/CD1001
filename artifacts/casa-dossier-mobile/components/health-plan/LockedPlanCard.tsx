import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── Locked state (free plan) ──────────────────────────────────────────────────
export function LockedPlanCard({
  colors,
  onClose,
  onUpgrade,
}: {
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28 }}>
      {/* Blurred preview hint */}
      <View style={{ opacity: 0.18, marginBottom: 24, gap: 8, pointerEvents: "none" }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[s.blurRow, { backgroundColor: "#dc2626", borderColor: "#fecaca" }]} />
        ))}
        <View style={[s.blurRow, { height: 60, backgroundColor: colors.card, borderColor: colors.border }]} />
        <View style={[s.blurRow, { height: 60, backgroundColor: colors.card, borderColor: colors.border }]} />
      </View>

      {/* Upgrade card */}
      <View style={[s.upgradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.lockIconWrap, { backgroundColor: colors.primary + "15" }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>
        <Text style={[s.upgradeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("healthPlan.unlockTitle")}
        </Text>
        <Text style={[s.upgradeDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {t("healthPlan.unlockDesc")}
        </Text>

        <View style={s.featureRow}>
          {[
            { icon: "clock" as const, label: t("healthPlan.featureOverdueAlerts") },
            { icon: "clipboard" as const, label: t("healthPlan.featureSpecs") },
            { icon: "shield" as const, label: t("healthPlan.featureTips") },
          ].map(({ icon, label }) => (
            <View key={label} style={[s.featureItem, { backgroundColor: colors.muted }]}>
              <Feather name={icon} size={15} color={colors.primary} />
              <Text style={[s.featureLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={onUpgrade}
          style={[s.upgradeBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Feather name="star" size={15} color={colors.primaryForeground} />
          <Text style={[s.upgradeBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.upgradeToBasic")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginTop: 4 }}>
          <Text style={[s.maybeLater, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("healthPlan.maybeLater")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  blurRow: { height: 40, borderRadius: 8, borderWidth: 1 },
  upgradeCard: { borderRadius: 18, borderWidth: 1, padding: 22, alignItems: "center", gap: 12 },
  lockIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  upgradeTitle: { fontSize: 17, textAlign: "center" },
  upgradeDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  featureRow: { flexDirection: "row", gap: 8, width: "100%" },
  featureItem: { flex: 1, alignItems: "center", gap: 6, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6 },
  featureLabel: { fontSize: 11, textAlign: "center", lineHeight: 15 },
  upgradeBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, width: "100%", justifyContent: "center" },
  upgradeBtnText: { fontSize: 15 },
  maybeLater: { fontSize: 13, textAlign: "center" },
});
