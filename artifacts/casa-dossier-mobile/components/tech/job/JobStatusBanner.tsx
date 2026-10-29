import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { TechJobDetail } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { fmtDate, statusOf, ui } from "@/components/tech/ui";

// ── Status banner: where the job stands, from this technician's point of view ─
export function JobStatusBanner({
  job, status, isMine, hasSchedule,
}: {
  job: TechJobDetail; status: string; isMine: boolean; hasSchedule: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const sc = statusOf(status);
  return (
    <View style={[styles.statusBanner, { backgroundColor: sc.color + "14", borderColor: sc.color + "40" }]}>
      <View style={[styles.statusIcon, { backgroundColor: sc.color + "20" }]}>
        <Feather name={sc.icon} size={20} color={sc.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.statusLabel, { color: sc.color, fontFamily: "Inter_700Bold" }]}>
          {status === "open"
            ? t("tech.banner.openTitle")
            : isMine
              ? sc.label
              : status === "completed"
                ? t("tech.banner.completedTitle")
                : t("tech.banner.claimedTitle")}
        </Text>
        <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {status === "open"
            ? t("tech.banner.openDesc")
            : status === "completed"
              ? t("tech.banner.completedDesc")
              : !isMine
                ? t("tech.banner.claimedDesc")
                : hasSchedule
                  ? t("tech.banner.scheduledFor", { date: fmtDate(job.scheduledAt, t("tech.dateFormats.weekdayShortTime")) })
                  : t("tech.banner.confirmDate")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  statusIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 15 },
});
