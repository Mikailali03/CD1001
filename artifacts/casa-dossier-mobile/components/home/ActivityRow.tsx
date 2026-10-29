import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";
import { CasaServiceBadge } from "@/components/CasaServiceBadge";
import { useColors } from "@/hooks/useColors";

// ── Recent Activity Row ────────────────────────────────────────────────────────
export function ActivityRow({
  description, assetName, companyName, date, colors,
}: {
  description: string; assetName?: string; companyName?: string; date: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={[actStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[actStyles.icon, { backgroundColor: colors.muted }]}>
        <Feather name="file-text" size={13} color={colors.primary} />
      </View>
      <View style={actStyles.content}>
        <Text style={[actStyles.desc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
          {description}
        </Text>
        <View style={actStyles.metaRow}>
          {assetName ? (
            <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {assetName} · 
            </Text>
          ) : null}
          {companyName === "CasaService" ? (
            <CasaServiceBadge />
          ) : (
            <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {companyName ?? t("home.serviceFallback")}
            </Text>
          )}
          <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {" · "}{formatDate(date, "PP")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const actStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  content: { flex: 1, gap: 3 },
  desc: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  meta: { fontSize: 11 },
});
