import React from "react";
import { CasaServiceBadge } from "@/components/CasaServiceBadge";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";
import { provenanceLabel } from "@/lib/provenance";
import type { ServiceRecord } from "./types";

// ── Service record row ─────────────────────────────────────────────────────────
export function RecordRow({ record, colors }: { record: ServiceRecord; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  return (
    <View style={[recordStyles.wrap, { borderLeftColor: colors.primary + "33" }]}>
      <View style={recordStyles.dot} />
      <View style={recordStyles.content}>
        <Text style={[recordStyles.desc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={3}>
          {record.description}
        </Text>
        <View style={recordStyles.meta}>
          <Text style={[recordStyles.date, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {formatDate(record.date, "MMM d, yyyy")}
          </Text>
          {record.technicianName && (
            <Text style={[recordStyles.tech, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · {record.technicianName}
            </Text>
          )}
          {record.verified ? (
            <CasaServiceBadge />
          ) : record.companyName ? (
            <Text style={[recordStyles.tech, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {record.technicianName ? ` (${record.companyName})` : `· ${record.companyName}`}
            </Text>
          ) : null}
          {record.cost != null && Number(record.cost) > 0 && (
            <Text style={[recordStyles.cost, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              · ${Number(record.cost).toLocaleString()}
            </Text>
          )}
        </View>
        <Text style={[recordStyles.provenance, {
          color: record.verified ? "#92400e" : colors.mutedForeground,
          fontFamily: "Inter_400Regular",
        }]}>
          {provenanceLabel(record, t)}
        </Text>
      </View>
    </View>
  );
}

const recordStyles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 12, paddingVertical: 10, borderLeftWidth: 2, paddingLeft: 12, marginBottom: 2 },
  dot: { position: "absolute", left: -5, top: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: "#0F1629" },
  content: { flex: 1, gap: 4 },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  date: { fontSize: 11 },
  tech: { fontSize: 11 },
  cost: { fontSize: 11 },
  provenance: { fontSize: 10 },
});
