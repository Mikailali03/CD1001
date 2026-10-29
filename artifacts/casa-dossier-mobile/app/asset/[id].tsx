import React, { useState } from "react";
import { Image } from "expo-image";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useGetAsset,
  useListServiceRecords,
  useListMaintenanceTasks,
  getListServiceRecordsQueryKey,
  getListMaintenanceTasksQueryKey,
  getGetAssetQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { CATEGORY_CONFIG, calcAssetScore, gradeFromScore } from "@/components/AssetCard";
import { formatDate } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import { EditAssetModal } from "@/components/asset/EditAssetModal";
import { LargeRadialGauge } from "@/components/asset/LargeRadialGauge";
import { LifeBar } from "@/components/asset/LifeBar";
import { LogServiceForm } from "@/components/asset/LogServiceForm";
import { MarkCompleteModal } from "@/components/asset/MarkCompleteModal";
import { RecordRow } from "@/components/asset/RecordRow";
import { SectionHeader } from "@/components/asset/SectionHeader";
import { SpecRow } from "@/components/asset/SpecRow";
import { TaskRow } from "@/components/asset/TaskRow";
import type { MaintenanceTask } from "@/components/asset/types";
import { resolveStorageUrl } from "@/lib/config";
import { invalidatePropertyData } from "@/lib/query-invalidation";
import { normCategory } from "@/components/asset/utils";

// ── Main asset detail screen ───────────────────────────────────────────────────
export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: asset, isLoading: assetLoading } = useGetAsset(id!);
  const { data: tasks = [], refetch: refetchTasks } = useListMaintenanceTasks(id!);
  const { data: records = [], refetch: refetchRecords } = useListServiceRecords(id!);

  const a = asset;
  const taskList = tasks;
  const recordList = records;

  const pendingTasks = taskList.filter((t) => !t.completedAt);
  const completedTasks = taskList.filter((t) => t.completedAt);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (assetLoading || !a) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topPad }}>
        {/* Header skeleton */}
        <View style={[detailStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={detailStyles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const cat = normCategory(a.category);
  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
  const score = calcAssetScore({ name: a.name, installDate: a.installDate, warrantyExpiry: a.warrantyExpiry, status: a.status, category: cat });
  const { color: gradeColor } = gradeFromScore(score);
  const underWarranty = a.warrantyExpiry ? new Date(a.warrantyExpiry) > new Date() : false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Sticky header ── */}
      <View style={[detailStyles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={detailStyles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={detailStyles.headerCenter}>
          <View style={[detailStyles.categoryBadge, { backgroundColor: cfg.bg }]}>
            <Text style={detailStyles.categoryEmoji}>{cfg.emoji}</Text>
          </View>
          <Text style={[detailStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
            {a.name}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("assetDetail.editAsset")}
          hitSlop={8}
          onPress={() => { Haptics.selectionAsync(); setEditOpen(true); }}
          style={detailStyles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card: gauge + meta ── */}
        <View style={[detailStyles.heroCard, { backgroundColor: colors.card, borderColor: cfg.color + "30" }]}>
          <LargeRadialGauge score={score} />
          <View style={{ marginTop: 12, gap: 8, alignItems: "center" }}>
            {/* Status badges */}
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {a.status === "verified" && (
                <View style={[detailStyles.pill, { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }]}>
                  <Feather name="shield" size={10} color="#059669" />
                  <Text style={[detailStyles.pillText, { color: "#059669", fontFamily: "Inter_700Bold" }]}>{t("assetDetail.badges.verified")}</Text>
                </View>
              )}
              {a.status === "needs_attention" && (
                <View style={[detailStyles.pill, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
                  <Feather name="alert-circle" size={10} color="#dc2626" />
                  <Text style={[detailStyles.pillText, { color: "#dc2626", fontFamily: "Inter_700Bold" }]}>{t("assetDetail.badges.needsAttention")}</Text>
                </View>
              )}
              {underWarranty && (
                <View style={[detailStyles.pill, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <Feather name="shield" size={10} color="#2563eb" />
                  <Text style={[detailStyles.pillText, { color: "#2563eb", fontFamily: "Inter_700Bold" }]}>{t("assetDetail.badges.underWarranty")}</Text>
                </View>
              )}
            </View>
            <Text style={[detailStyles.categoryLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {cfg.emoji} {t(`categories.${cat}`, { defaultValue: cat })}
            </Text>
          </View>

          {/* Life-used bar */}
          {a.installDate && (
            <View style={{ width: "100%", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              <LifeBar installDate={a.installDate} category={cat} name={a.name} colors={colors} />
            </View>
          )}
        </View>

        {/* ── Asset Photo ── */}
        {!!a.photoUrl && (
          <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
            <Image
              source={{ uri: resolveStorageUrl(a.photoUrl) }}
              style={{ width: "100%", height: 200 }}
              contentFit="cover"
            />
          </View>
        )}

        {/* ── Request a Pro CTA ── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync();
            router.push({
              pathname: "/(tabs)/find-a-pro",
              params: { propertyId: a.propertyId, assetId: a.id },
            });
          }}
          style={[detailStyles.requestProBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="user-check" size={16} color={colors.primaryForeground} />
          <Text style={[detailStyles.requestProText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
            {t("assetDetail.requestPro")}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.primaryForeground + "b3"} />
        </TouchableOpacity>

        {/* ── Specifications ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title={t("assetDetail.specifications")} icon="info" colors={colors} />
          {a.brand && <SpecRow label={t("assetDetail.spec.brand")} value={a.brand} colors={colors} />}
          {a.model && <SpecRow label={t("assetDetail.spec.model")} value={a.model} colors={colors} />}
          {a.serialNumber && <SpecRow label={t("assetDetail.spec.serial")} value={a.serialNumber} mono colors={colors} />}
          {a.installDate && (
            <SpecRow label={t("assetDetail.spec.installed")} value={formatDate(a.installDate, "MMM d, yyyy")} colors={colors} />
          )}
          {a.warrantyExpiry && (
            <SpecRow
              label={t("assetDetail.spec.warrantyExpires")}
              value={underWarranty
                ? t("assetDetail.spec.warrantyActive", { date: formatDate(a.warrantyExpiry, "MMM d, yyyy") })
                : t("assetDetail.spec.warrantyExpired", { date: formatDate(a.warrantyExpiry, "MMM d, yyyy") })}
              colors={colors}
            />
          )}
          {a.replacementCost != null && Number(a.replacementCost) > 0 && (
            <SpecRow label={t("assetDetail.spec.replacementCost")} value={`$${Number(a.replacementCost).toLocaleString()}`} colors={colors} />
          )}
          {!a.brand && !a.model && !a.serialNumber && !a.installDate && !a.warrantyExpiry && (
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", paddingVertical: 8 }]}>
              {t("assetDetail.noSpecs")}
            </Text>
          )}
        </View>

        {/* ── Maintenance Tasks ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title={t("assetDetail.maintenanceTasks")} icon="tool" colors={colors} />
          {pendingTasks.length === 0 ? (
            <View style={[detailStyles.emptyState, { backgroundColor: colors.accent, borderColor: colors.border }]}>
              <Feather name="check-circle" size={18} color={colors.accentForeground} />
              <Text style={[{ fontSize: 13, color: colors.accentForeground, fontFamily: "Inter_500Medium" }]}>
                {t("assetDetail.noPending")}
              </Text>
            </View>
          ) : (
            pendingTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assetId={a.id}
                colors={colors}
                onMarkDone={(task) => { setActiveTask(task); Haptics.selectionAsync(); }}
              />
            ))
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 6 }]}>
                {t("assetDetail.completedCount", { count: completedTasks.length })}
              </Text>
              {completedTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={[detailStyles.completedRow, { borderBottomColor: colors.border }]}>
                  <Feather name="check-circle" size={13} color="#059669" />
                  <Text style={[{ flex: 1, fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.completedAt && (
                    <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {formatDate(task.completedAt, "MMM d")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Service History ── */}
        <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionHeader title={t("assetDetail.serviceHistory")} icon="file-text" colors={colors} />
          {recordList.length === 0 ? (
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", paddingVertical: 4 }]}>
              {t("assetDetail.noRecords")}
            </Text>
          ) : (
            <View style={{ paddingLeft: 4 }}>
              {recordList.map((record) => (
                <RecordRow key={record.id} record={record} colors={colors} />
              ))}
            </View>
          )}

          {/* Log service record form */}
          <View style={{ marginTop: 16 }}>
            <LogServiceForm
              assetId={a.id}
              colors={colors}
              onSuccess={() => {
                refetchRecords();
                queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(a.id) });
              }}
            />
          </View>
        </View>

        {/* Notes */}
        {a.notes && (
          <View style={[detailStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader title={t("assetDetail.notes")} icon="align-left" colors={colors} />
            <Text style={[{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 20 }]}>
              {a.notes}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Mark Complete Modal */}
      <MarkCompleteModal
        task={activeTask}
        assetId={a.id}
        visible={!!activeTask}
        onClose={() => setActiveTask(null)}
        colors={colors}
        onSuccess={() => {
          refetchTasks();
          refetchRecords();
          queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(a.id) });
          queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(a.id) });
          invalidatePropertyData(queryClient, a.propertyId);
        }}
      />

      {/* Edit Asset Modal */}
      <EditAssetModal
        asset={a}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        colors={colors}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(a.id) });
          invalidatePropertyData(queryClient, a.propertyId);
        }}
      />
    </View>
  );
}

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  categoryBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  categoryEmoji: { fontSize: 16 },
  headerTitle: { flex: 1, fontSize: 16, lineHeight: 20 },
  heroCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 20,
    alignItems: "center", marginBottom: 16,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  pillText: { fontSize: 11 },
  categoryLabel: { fontSize: 13, marginTop: 2 },
  section: {
    borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  emptyState: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  completedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  requestProBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    marginBottom: 16,
  },
  requestProText: { flex: 1, fontSize: 15 },
});
