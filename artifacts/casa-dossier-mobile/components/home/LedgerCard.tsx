import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── Investment Ledger Card ────────────────────────────────────────────────────
export function LedgerCard({ colors, onPress }: { colors: ReturnType<typeof useColors>; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[ledgerStyles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={ledgerStyles.top}>
        <View style={[ledgerStyles.iconBox, { backgroundColor: colors.primary + "1A" }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
        </View>
        <View style={ledgerStyles.topText}>
          <Text style={[ledgerStyles.topTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("home.ledger.title")}
          </Text>
          <Text style={[ledgerStyles.topSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("home.ledger.subtitle")}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
      <View style={[ledgerStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.muted + "33" }]}>
        {[
          { icon: "dollar-sign" as const, label: t("home.ledger.trackSpend"), sub: t("home.ledger.bySystem") },
          { icon: "trending-up" as const, label: t("home.ledger.compare"), sub: t("home.ledger.estVsActual") },
          { icon: "file-text" as const, label: t("home.ledger.fullLedger"), sub: t("home.ledger.allRecords") },
        ].map(({ icon, label, sub }) => (
          <View key={label} style={[ledgerStyles.cell, { borderLeftColor: colors.border }]}>
            <Feather name={icon} size={12} color={colors.primary} />
            <Text style={[ledgerStyles.cellLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
            <Text style={[ledgerStyles.cellSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const ledgerStyles = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  topText: { flex: 1, gap: 2 },
  topTitle: { fontSize: 14 },
  topSub: { fontSize: 11 },
  footer: { flexDirection: "row", borderTopWidth: 1 },
  cell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  cellLabel: { fontSize: 11 },
  cellSub: { fontSize: 10 },
});
