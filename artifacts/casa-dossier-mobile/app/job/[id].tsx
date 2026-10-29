import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getGetMarketplaceJobDetailsQueryKey,
  useGetMarketplaceJobDetails,
  type TechJobDetail,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { CATEGORY_CONFIG } from "@/components/AssetCard";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";

// ── Types ──────────────────────────────────────────────────────────────────────
type JobDetail = TechJobDetail;

/** A pro has the job: accepted, on the way, or on site. */
function isAssigned(status: JobDetail["status"]) {
  return status === "claimed" || status === "en_route" || status === "arrived";
}

// ── Config ─────────────────────────────────────────────────────────────────────
// Labels: jobDetail.urgency.<key>
const URGENCY_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Feather.glyphMap }> = {
  emergency: { color: "#dc2626", bg: "#fef2f2", icon: "alert-circle" },
  high:      { color: "#ea580c", bg: "#fff7ed", icon: "alert-circle" },
  medium:    { color: "#d97706", bg: "#fffbeb", icon: "clock" },
  low:       { color: "#6b7280", bg: "#f3f4f6", icon: "clock" },
};

// Labels: jobDetail.status.<key>
const STATUS_CONFIG: Record<string, { color: string; bg: string; borderColor: string; icon: keyof typeof Feather.glyphMap }> = {
  open:      { color: "#0369a1", bg: "#eff6ff", borderColor: "#bae6fd", icon: "search" },
  claimed:   { color: "#059669", bg: "#ecfdf5", borderColor: "#6ee7b7", icon: "check-circle" },
  en_route:  { color: "#059669", bg: "#ecfdf5", borderColor: "#6ee7b7", icon: "truck" },
  arrived:   { color: "#059669", bg: "#ecfdf5", borderColor: "#6ee7b7", icon: "map-pin" },
  completed: { color: "#7c3aed", bg: "#f5f3ff", borderColor: "#c4b5fd", icon: "check-circle" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡", Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

function normCat(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const detail = useGetMarketplaceJobDetails(id ?? "", {
    query: { queryKey: getGetMarketplaceJobDetailsQueryKey(id ?? ""), enabled: !!id },
  });
  const job: JobDetail | undefined = detail.data;
  const loading = detail.isPending;
  const error = detail.isError;
  const serviceHistory = job?.serviceHistory ?? [];

  const urgencyKey = job?.urgency && URGENCY_CONFIG[job.urgency] ? job.urgency : "medium";
  const statusKey = job?.status && STATUS_CONFIG[job.status] ? job.status : "open";
  const uc = URGENCY_CONFIG[urgencyKey]!;
  const sc = STATUS_CONFIG[statusKey]!;
  const cat = normCat(job?.assetCategory ?? "");
  const catCfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
  const catEmoji = CATEGORY_EMOJI[cat] ?? "📦";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("jobDetail.title")}
          </Text>
          {job && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("jobDetail.posted", { date: formatDate(job.createdAt, "MMM d, yyyy") })}
            </Text>
          )}
        </View>
        {job && (
          <View style={[styles.urgencyChip, { backgroundColor: uc.bg }]}>
            <Feather name={uc.icon} size={11} color={uc.color} />
            <Text style={[styles.urgencyChipText, { color: uc.color, fontFamily: "Inter_700Bold" }]}>
              {t(`jobDetail.urgency.${urgencyKey}`)}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !job ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <Feather name="alert-triangle" size={36} color={colors.mutedForeground + "60"} />
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textAlign: "center" }]}>
            {t("jobDetail.loadError")}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.retryBtn, { borderColor: colors.border }]}>
            <Text style={[{ fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" }]}>{t("common.goBack")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: sc.bg, borderColor: sc.borderColor }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: sc.color + "20" }]}>
              <Feather name={sc.icon} size={20} color={sc.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.statusLabel, { color: sc.color, fontFamily: "Inter_700Bold" }]}>
                {t(`jobDetail.status.${statusKey}`)}
              </Text>
              {isAssigned(job.status) && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {job.scheduledAt
                    ? t("jobDetail.scheduledFor", { date: formatDate(job.scheduledAt, "EEEE, MMMM d"), time: formatDate(job.scheduledAt, "h:mm a") })
                    : t("jobDetail.proWillConfirm")}
                </Text>
              )}
              {job.status === "open" && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("jobDetail.waitingForPro")}
                </Text>
              )}
              {job.status === "completed" && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("jobDetail.completedSub")}
                </Text>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={13} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                {t("jobDetail.description")}
              </Text>
            </View>
            <Text style={[styles.descText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
              {job.description}
            </Text>
          </View>

          {/* Asset on file */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="tool" size={13} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                {t("jobDetail.assetOnFile")}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.assetRow, { backgroundColor: catCfg.bg, borderColor: colors.border }]}
              onPress={() => job.assetId && router.push(`/asset/${job.assetId}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.assetEmoji, { backgroundColor: catCfg.bg }]}>
                <Text style={{ fontSize: 22 }}>{catEmoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.assetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {job.assetName}
                </Text>
                {(job.assetBrand || job.assetModel || job.assetSerialNumber) && (
                  <Text style={[styles.assetMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {[job.assetBrand, job.assetModel, job.assetSerialNumber && t("jobDetail.serial", { serial: job.assetSerialNumber })]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
                {job.assetInstallDate && (
                  <Text style={[styles.assetMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("jobDetail.installed", { date: formatDate(job.assetInstallDate, "MMM yyyy") })}
                  </Text>
                )}
              </View>
              <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Location */}
            {(job.propertyCity || job.propertyState) && (
              <View style={[styles.locationRow, { borderTopColor: colors.border }]}>
                <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                <Text style={[styles.locationText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {[job.propertyCity, job.propertyState, job.propertyZipCode].filter(Boolean).join(", ")}
                </Text>
              </View>
            )}
          </View>

          {/* Assigned pro (if claimed) */}
          {isAssigned(job.status) && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="user-check" size={13} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {t("jobDetail.assignedPro")}
                </Text>
              </View>

              <View style={styles.techRow}>
                <View style={[styles.techAvatar, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="user" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.techName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("jobDetail.casaServicePro")}
                  </Text>
                  {job.acceptedAt && (
                    <Text style={[styles.techSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t("jobDetail.accepted", { date: formatDate(job.acceptedAt, "MMM d, yyyy") })}
                    </Text>
                  )}
                </View>
                {job.contactPhone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${job.contactPhone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={t("jobDetail.callPro")}
                    style={[styles.callBtn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="phone" size={14} color={colors.primaryForeground} />
                    <Text style={[styles.callBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {t("jobDetail.call")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.scheduleBlock, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                {job.scheduledAt ? (
                  <Text style={[styles.scheduleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {t("jobDetail.dateAtTime", { date: formatDate(job.scheduledAt, "EEEE, MMMM d, yyyy"), time: formatDate(job.scheduledAt, "h:mm a") })}
                  </Text>
                ) : (
                  <Text style={[styles.scheduleText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontStyle: "italic" }]}>
                    {t("jobDetail.datePending")}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Asset notes */}
          {job.assetNotes && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="info" size={13} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {t("jobDetail.assetNotes")}
                </Text>
              </View>
              <Text style={[styles.descText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                {job.assetNotes}
              </Text>
            </View>
          )}

          {/* Service history (last 3 records) */}
          {serviceHistory.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {t("jobDetail.serviceHistory")}
                </Text>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginLeft: 2 }]}>
                  · {t("jobDetail.recordCount", { count: serviceHistory.length })}
                </Text>
              </View>
              {serviceHistory.slice(-4).reverse().map((rec, idx, arr) => (
                <View
                  key={rec.id}
                  style={[
                    styles.historyRow,
                    { borderBottomColor: colors.border },
                    idx === arr.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.historyDesc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
                      {rec.description}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.historyDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {formatDate(rec.date, "MMM d, yyyy")}
                      </Text>
                      {rec.cost && Number(rec.cost) > 0 && (
                        <Text style={[styles.historyCost, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                          ${Number(rec.cost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* View full asset link */}
          <TouchableOpacity
            style={[styles.assetLinkBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => job.assetId && router.push(`/asset/${job.assetId}`)}
            activeOpacity={0.7}
          >
            <Feather name="package" size={15} color={colors.primary} />
            <Text style={[styles.assetLinkText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {t("jobDetail.viewAsset")}
            </Text>
            <Feather name="chevron-right" size={15} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 11 },
  urgencyChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
  },
  urgencyChipText: { fontSize: 11 },
  statusBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  statusIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 15 },
  statusSub: { fontSize: 12, lineHeight: 17 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8 },
  descText: { fontSize: 13, lineHeight: 20 },
  assetRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 10, borderWidth: 1, padding: 12,
  },
  assetEmoji: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  assetName: { fontSize: 14 },
  assetMeta: { fontSize: 11, lineHeight: 16 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  locationText: { fontSize: 12 },
  techRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  techAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  techName: { fontSize: 14 },
  techSub: { fontSize: 11 },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
  },
  callBtnText: { fontSize: 13 },
  scheduleBlock: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  scheduleText: { flex: 1, fontSize: 13, lineHeight: 19 },
  historyRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  historyDesc: { fontSize: 13, lineHeight: 18 },
  historyDate: { fontSize: 11 },
  historyCost: { fontSize: 11 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  assetLinkBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  assetLinkText: { flex: 1, fontSize: 14 },
});
