import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useGetPropertySummary, getGetPropertySummaryQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { addDays, formatDate, scoreBg, scoreBorder, scoreColor, scoreLabel, toISODate } from "./score";

// ── Property health modal ─────────────────────────────────────────────────────
interface HealthModalProps {
  propertyId: string;
  propertyName: string;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number };
}

export function PropertyHealthModal({ propertyId, propertyName, visible, onClose, colors, insets }: HealthModalProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId), enabled: visible },
  });
  const summary = data;

  const today = new Date();
  const todayStr = toISODate(today);
  const in30Days = toISODate(addDays(today, 30));
  const ago60Days = toISODate(addDays(today, -60));

  const next30Tasks = (summary?.upcomingTasks ?? []).filter(
    (t) => t.nextDueDate >= todayStr && t.nextDueDate <= in30Days,
  );
  const overdueTasks = summary?.overdueTasks ?? [];
  const lowAssets = (summary?.assetScores ?? [])
    .filter((s) => s.score < 75)
    .sort((a, b) => a.score - b.score);
  const recentRecords = (summary?.recentRecords ?? []).filter((r) => r.date >= ago60Days);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[mStyles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[mStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={[mStyles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[mStyles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.sheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                {propertyName}
              </Text>
              <Text style={[mStyles.sheetSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("propertyHealth.subtitle")}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={[mStyles.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : !summary ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
                {t("propertyHealth.loadFailed")}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Score banner */}
              <View style={[mStyles.scoreBanner, { backgroundColor: scoreBg(summary.healthScore), borderColor: scoreBorder(summary.healthScore) }]}>
                <View style={mStyles.scoreLeft}>
                  <Text style={[mStyles.scoreNum, { color: scoreColor(summary.healthScore), fontFamily: "Inter_700Bold" }]}>
                    {summary.healthScore}
                  </Text>
                  <Text style={[mStyles.scoreDenom, { color: scoreColor(summary.healthScore), fontFamily: "Inter_400Regular" }]}>
                    / 100
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mStyles.scoreLabel, { color: scoreColor(summary.healthScore), fontFamily: "Inter_600SemiBold" }]}>
                    {t("propertyHealth.scoreLabel", { label: t(`properties.score.${scoreLabel(summary.healthScore)}`), grade: summary.healthGrade })}
                  </Text>
                  <Text style={[mStyles.scoreMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("propertyHealth.assetsTracked", { count: summary.totalAssets })}
                    {summary.overdueTaskCount > 0 ? ` · ${t("propertyHealth.overdueCount", { count: summary.overdueTaskCount })}` : ""}
                  </Text>
                </View>
              </View>

              {/* Assets needing attention */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="shield" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("propertyHealth.assetsNeedingAttention")}
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {lowAssets.length}
                    </Text>
                  </View>
                </View>
                {lowAssets.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("propertyHealth.allAssetsHealthy")}
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {lowAssets.map((asset) => (
                      <View key={asset.assetId} style={[mStyles.assetRow, { backgroundColor: scoreBg(asset.score), borderColor: scoreBorder(asset.score) }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.assetName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                            {asset.assetName}
                          </Text>
                          <Text style={[mStyles.assetMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            {t(`categories.${asset.category}`, { defaultValue: asset.category })} · {t("propertyHealth.ageOfLifespan", { age: asset.ageYears, lifespan: asset.lifespanYears })}
                          </Text>
                        </View>
                        <Text style={[mStyles.assetScore, { color: scoreColor(asset.score), fontFamily: "Inter_700Bold" }]}>
                          {asset.score}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Maintenance next 30 days */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="calendar" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("propertyHealth.next30Days")}
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {overdueTasks.length + next30Tasks.length}
                    </Text>
                  </View>
                </View>
                {overdueTasks.length === 0 && next30Tasks.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("propertyHealth.nothingDue")}
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {overdueTasks.map((task) => (
                      <View key={task.id} style={[mStyles.taskRow, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                        <Feather name="alert-triangle" size={13} color="#ef4444" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
                          {task.assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{task.assetName}</Text> : null}
                        </View>
                        <Text style={[mStyles.taskDate, { color: "#ef4444", fontFamily: "Inter_500Medium" }]}>{t("propertyHealth.overdue")}</Text>
                      </View>
                    ))}
                    {next30Tasks.map((task) => (
                      <View key={task.id} style={[mStyles.taskRow, { backgroundColor: colors.muted + "60", borderColor: colors.border }]}>
                        <Feather name="tool" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
                          {task.assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{task.assetName}</Text> : null}
                        </View>
                        <Text style={[mStyles.taskDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {formatDate(task.nextDueDate)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Recently completed */}
              <View style={mStyles.section}>
                <View style={mStyles.sectionHeader}>
                  <Feather name="check-circle" size={14} color={colors.mutedForeground} />
                  <Text style={[mStyles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("propertyHealth.recentlyCompleted")}
                  </Text>
                  <View style={[mStyles.badge, { backgroundColor: colors.muted }]}>
                    <Text style={[mStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {recentRecords.length}
                    </Text>
                  </View>
                </View>
                {recentRecords.length === 0 ? (
                  <Text style={[mStyles.emptyNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("propertyHealth.noRecent")}
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {recentRecords.map((record) => (
                      <View key={record.id} style={[mStyles.taskRow, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                        <Feather name="check-circle" size={13} color="#10b981" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[mStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{record.description}</Text>
                          {record.assetName ? <Text style={[mStyles.taskMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{record.assetName}</Text> : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[mStyles.taskDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{formatDate(record.date)}</Text>
                          {record.cost != null && (
                            <Text style={[mStyles.taskDate, { color: "#10b981", fontFamily: "Inter_500Medium" }]}>
                              ${Number(record.cost).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", minHeight: "50%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16 },
  sheetSub: { fontSize: 12, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  scoreBanner: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  scoreLeft: { alignItems: "center", minWidth: 48 },
  scoreNum: { fontSize: 32, lineHeight: 36 },
  scoreDenom: { fontSize: 11, marginTop: 1 },
  scoreLabel: { fontSize: 14 },
  scoreMeta: { fontSize: 12, marginTop: 2 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 13, flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  emptyNote: { fontSize: 12, fontStyle: "italic", paddingLeft: 4 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  assetName: { fontSize: 13 },
  assetMeta: { fontSize: 11, marginTop: 1 },
  assetScore: { fontSize: 17 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  taskTitle: { fontSize: 13, lineHeight: 18 },
  taskMeta: { fontSize: 11, marginTop: 1 },
  taskDate: { fontSize: 11, marginTop: 1 },
});
