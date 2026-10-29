import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";
import { useListMarketplaceJobs, type MarketplaceJob } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// ── Active Service Requests ───────────────────────────────────────────────────
const URGENCY_BORDER: Record<string, string> = {
  emergency: "#dc2626",
  high:      "#ea580c",
  medium:    "#d97706",
  low:       "#94a3b8",
};
const URGENCY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  emergency: "alert-circle",
  high:      "alert-circle",
  medium:    "clock",
  low:       "clock",
};

export function ActiveServiceRequests({ colors, onJobPress, propertyId }: { colors: ReturnType<typeof useColors>; onJobPress: (id: string) => void; propertyId?: string }) {
  const { t } = useTranslation();
  const { data: jobs } = useListMarketplaceJobs();
  const activeJobs = (jobs ?? []).filter(
    (j: MarketplaceJob) =>
      (!propertyId || j.propertyId === propertyId) &&
      (j.status === "open" ||
      j.status === "claimed" ||
      j.status === "en_route" ||
      j.status === "arrived")
  );
  if (!activeJobs.length) return null;

  return (
    <View style={activeStyles.wrap}>
      {/* Header */}
      <View style={activeStyles.header}>
        <View style={activeStyles.headerLeft}>
          <View style={[activeStyles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="tool" size={13} color={colors.primary} />
          </View>
          <Text style={[activeStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("home.activeRequests")}
          </Text>
          <View style={[activeStyles.countBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[activeStyles.countText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {activeJobs.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Horizontal card scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
        style={{ marginLeft: -20, paddingLeft: 20 }}
      >
        {activeJobs.map((job: MarketplaceJob) => {
          const urgency = job.urgency ?? "medium";
          const accentColor = URGENCY_BORDER[urgency] ?? "#d97706";
          const iconName = URGENCY_ICON[urgency] ?? "clock";
          const jobStatus: string = job.status;
          const scheduledAt = job.scheduledAt;

          const STATUS_LABEL: Record<string, string> = {
            open:     t("home.jobStatus.open"),
            claimed:  t("home.jobStatus.claimed"),
            en_route: t("home.jobStatus.en_route"),
            arrived:  t("home.jobStatus.arrived"),
          };
          const STATUS_BG: Record<string, string> = {
            open:     colors.muted,
            claimed:  colors.primary + "18",
            en_route: "#3b82f620",
            arrived:  "#10b98120",
          };
          const STATUS_COLOR: Record<string, string> = {
            open:     colors.mutedForeground,
            claimed:  colors.primary,
            en_route: "#3b82f6",
            arrived:  "#10b981",
          };

          return (
            <TouchableOpacity
              key={job.id}
              activeOpacity={0.72}
              onPress={() => { Haptics.selectionAsync(); onJobPress(job.id); }}
              style={[
                activeStyles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: accentColor,
                },
              ]}
            >
              {/* Top row: icon + asset name + badge */}
              <View style={activeStyles.cardTop}>
                <Feather name={iconName} size={13} color={accentColor} />
                <Text
                  style={[activeStyles.assetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                  numberOfLines={1}
                >
                  {job.assetName}
                </Text>
                <View style={[
                  activeStyles.statusBadge,
                  { backgroundColor: STATUS_BG[jobStatus] ?? colors.muted },
                ]}>
                  <Text style={[
                    activeStyles.statusText,
                    { color: STATUS_COLOR[jobStatus] ?? colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                  ]}>
                    {STATUS_LABEL[jobStatus] ?? jobStatus}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text
                style={[activeStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={2}
              >
                {job.description}
              </Text>

              {/* Scheduled row (once a pro is assigned) */}
              {jobStatus !== "open" && (
                <View style={activeStyles.scheduleRow}>
                  <Feather name="calendar" size={11} color={colors.mutedForeground} />
                  {scheduledAt ? (
                    <Text style={[activeStyles.scheduleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {formatDate(scheduledAt, t("home.scheduledAtFormat"))}
                    </Text>
                  ) : (
                    <Text style={[activeStyles.scheduleText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t("home.serviceDatePending")}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const activeStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 14 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  countText: { fontSize: 11 },
  card: {
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetName: { flex: 1, fontSize: 12 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontSize: 10 },
  desc: { fontSize: 12, lineHeight: 17 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  scheduleText: { fontSize: 11 },
});
