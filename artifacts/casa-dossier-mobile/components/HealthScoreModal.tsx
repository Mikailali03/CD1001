import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  getListMaintenanceTasksQueryKey,
  getListServiceRecordsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { getSpecsForCategory, type MaintenanceSpec } from "@workspace/maintenance-specs";
import * as Haptics from "expo-haptics";
import { TIER_RANK, useSubscription } from "@/hooks/useSubscription";
import { invalidatePropertyData } from "@/lib/query-invalidation";
import { Trans, useTranslation } from "react-i18next";
import { LockedPlanCard } from "@/components/health-plan/LockedPlanCard";
import { OverdueTaskRow } from "@/components/health-plan/OverdueTaskRow";
import { SpecRow } from "@/components/health-plan/SpecRow";
import type { AssetScore, CompletePayload, OverdueTask } from "@/components/health-plan/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  healthScore: number;
  healthGrade: string;
  overdueTaskCount: number;
  overdueTasks?: OverdueTask[];
  assetScores?: AssetScore[];
  propertyId: string;
};

// ── Grade colors ──────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: "#3d7a5f",
  B: "#4b7fb5",
  C: "#c8853a",
  D: "#b85a2a",
  F: "#c0392b",
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export function HealthScoreModal({
  visible,
  onClose,
  healthScore,
  healthGrade,
  overdueTaskCount,
  overdueTasks = [],
  assetScores = [],
  propertyId,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const gradeColor = GRADE_COLOR[healthGrade] ?? "#c8853a";
  // Check subscription to decide locked state (a failed lookup shows the upgrade card)
  const { subscription, isLoading: subLoading } = useSubscription();
  const locked = !subLoading && (TIER_RANK[subscription?.tier ?? "essential"] ?? 0) < 1;

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completedSpecKeys, setCompletedSpecKeys] = useState<Set<string>>(new Set());

  const remainingOverdue = overdueTaskCount - completedIds.size;
  const potentialGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + potentialGain, 100);

  function invalidateAll(assetId?: string) {
    invalidatePropertyData(qc, propertyId);
    if (assetId) {
      qc.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      qc.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(assetId) });
    }
  }

  async function handleMarkDone(taskId: string, payload: CompletePayload) {
    try {
      await completeMaintenanceTask(taskId, payload);
    } catch {
      Alert.alert(t("common.error"), t("healthPlan.markDoneFailed"));
      return;
    }
    setCompletedIds((prev) => new Set([...prev, taskId]));
    invalidateAll(overdueTasks.find((t) => t.id === taskId)?.assetId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleMarkSpecDone(assetId: string, spec: MaintenanceSpec, payload: CompletePayload) {
    // Step 1: create task
    let taskId: string;
    try {
      const task = await createMaintenanceTask(assetId, {
        title: spec.title,
        description: spec.description,
        intervalDays: spec.intervalDays,
        isDiy: spec.isDiy,
        nextDueDate: new Date().toLocaleDateString("en-CA"),
      });
      taskId = task.id;
    } catch {
      Alert.alert(t("common.error"), t("healthPlan.createFailed"));
      return;
    }

    // Step 2: complete it
    try {
      await completeMaintenanceTask(taskId, payload);
    } catch {
      Alert.alert(t("common.error"), t("healthPlan.createdNotCompleted"));
      return;
    }
    setCompletedSpecKeys((prev) => new Set([...prev, `${assetId}:${spec.title}`]));
    invalidateAll(assetId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Build spec recommendations from assetScores
  const recommendedByAsset = assetScores
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((asset) =>
      getSpecsForCategory(asset.category)
        .filter((s) => s.isDiy)
        .slice(0, 2)
        .map((spec) => ({ spec, asset }))
    )
    .slice(0, 10);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* ── Header ── */}
        <View style={[m.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <View style={m.headerTop}>
            <Text style={[m.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("healthPlan.title")}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Grade badge */}
          <View style={[m.gradeBadge, { backgroundColor: gradeColor + "18", borderColor: gradeColor + "40" }]}>
            <Feather name="trending-up" size={13} color={gradeColor} />
            <Text style={[m.gradeText, { color: gradeColor, fontFamily: "Inter_700Bold" }]}>
              {t("healthPlan.gradeBadge", { grade: healthGrade, score: healthScore })}
            </Text>
          </View>

          {/* Potential score banner */}
          {overdueTaskCount > 0 && completedIds.size < overdueTaskCount && (
            <View style={[m.banner, { backgroundColor: colors.primary + "0f", borderColor: colors.primary + "30" }]}>
              <Feather name="trending-up" size={14} color={colors.primary} />
              <Text style={[m.bannerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                <Trans
                  i18nKey="healthPlan.fixRemaining"
                  count={remainingOverdue}
                  values={{ count: remainingOverdue, score: potentialScore }}
                  components={{ bold: <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }} /> }}
                />
              </Text>
            </View>
          )}
          {completedIds.size > 0 && completedIds.size >= overdueTaskCount && (
            <View style={[m.banner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Feather name="check-circle" size={14} color="#16a34a" />
              <Text style={[m.bannerText, { color: "#15803d", fontFamily: "Inter_500Medium" }]}>
                {t("healthPlan.allOverdueDone")}
              </Text>
            </View>
          )}
        </View>

        {/* ── Body ── */}
        {subLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : locked ? (
          <LockedPlanCard
            colors={colors}
            onClose={onClose}
            onUpgrade={() => { onClose(); router.push("/upgrade"); }}
          />
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Section 1: Overdue tasks */}
              {overdueTaskCount > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={m.sectionHeader}>
                    <Feather name="clock" size={14} color="#dc2626" />
                    <Text style={[m.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.fixFirst")}</Text>
                    <View style={[m.countBadge, { backgroundColor: "#dc2626" }]}>
                      <Text style={[m.countText, { fontFamily: "Inter_700Bold" }]}>{t("healthPlan.remaining", { count: remainingOverdue })}</Text>
                    </View>
                  </View>
                  {overdueTasks.map((task) => (
                    <OverdueTaskRow
                      key={task.id}
                      task={task}
                      done={completedIds.has(task.id)}
                      onMarkDone={handleMarkDone}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {/* Divider */}
              {overdueTaskCount > 0 && recommendedByAsset.length > 0 && (
                <View style={[m.divider, { backgroundColor: colors.border }]} />
              )}

              {/* Section 2: Manufacturer spec recommendations */}
              {recommendedByAsset.length > 0 && (
                <View style={{ gap: 8 }}>
                  <View style={m.sectionHeader}>
                    <Feather name="tool" size={14} color={colors.primary} />
                    <Text style={[m.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.recommendedByManufacturers")}</Text>
                    <View style={[m.diyBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[m.diyText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("healthPlan.diyFirst")}</Text>
                    </View>
                  </View>
                  <Text style={[m.sectionDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("healthPlan.specsExplainer")}
                  </Text>
                  {recommendedByAsset.map(({ spec, asset }, i) => (
                    <SpecRow
                      key={`${asset.assetId}-${i}`}
                      spec={spec}
                      assetId={asset.assetId}
                      assetName={asset.assetName}
                      done={completedSpecKeys.has(`${asset.assetId}:${spec.title}`)}
                      onMarkDone={handleMarkSpecDone}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {overdueTaskCount === 0 && recommendedByAsset.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
                  <Feather name="check-circle" size={44} color="#16a34a" style={{ opacity: 0.6 }} />
                  <Text style={[{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }]}>{t("healthPlan.greatShape")}</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 19 }]}>
                    {t("healthPlan.noActionNeeded")}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[m.footer, { borderTopColor: colors.border, backgroundColor: colors.muted + "50" }]}>
              <Text style={[m.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("healthPlan.footer")}
              </Text>
              <TouchableOpacity onPress={onClose} style={[m.closeFooterBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.7}>
                <Text style={[m.closeFooterText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("common.close")}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 17, flex: 1, paddingRight: 8, lineHeight: 23 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  gradeBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  gradeText: { fontSize: 13 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  bannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { fontSize: 13, flex: 1 },
  countBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  countText: { color: "#fff", fontSize: 10 },
  diyBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  diyText: { fontSize: 10 },
  sectionDesc: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  footerText: { fontSize: 12, flex: 1, lineHeight: 17 },
  closeFooterBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  closeFooterText: { fontSize: 13 },
});
