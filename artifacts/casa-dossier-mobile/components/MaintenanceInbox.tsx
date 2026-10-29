import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  completeMaintenanceTask,
  getGetPropertyMaintenanceInboxQueryKey,
  getListMaintenanceTasksQueryKey,
  getListServiceRecordsQueryKey,
  useGetPropertyMaintenanceInbox,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { invalidatePropertyData } from "@/lib/query-invalidation";
import { useTranslation } from "react-i18next";
import { CompleteSheet } from "@/components/maintenance-inbox/CompleteSheet";
import { TaskRow } from "@/components/maintenance-inbox/TaskRow";
import type { CompletePayload, InboxTask } from "@/components/maintenance-inbox/helpers";


interface MaintenanceInboxProps {
  propertyId: string;
  insetBottom?: number;
}

export function MaintenanceInbox({ propertyId, insetBottom = 0 }: MaintenanceInboxProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [activeTask, setActiveTask] = useState<InboxTask | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const inboxKey = getGetPropertyMaintenanceInboxQueryKey(propertyId);
  const { data, isLoading } = useGetPropertyMaintenanceInbox(propertyId, {
    query: { queryKey: inboxKey, refetchInterval: 60_000, enabled: !!propertyId },
  });

  const markDone = useCallback(async (payload: CompletePayload) => {
    if (!activeTask) return;
    try {
      await completeMaintenanceTask(activeTask.id, {
        ...payload,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
    } catch (err) {
      Alert.alert(t("common.error"), t("maintenanceInbox.completeFailed"));
      throw err;
    }
    setActiveTask(null);
    await queryClient.invalidateQueries({ queryKey: inboxKey });
    queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(activeTask.assetId) });
    queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(activeTask.assetId) });
    invalidatePropertyData(queryClient, propertyId);
  }, [activeTask, propertyId, queryClient, t]);

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const total = overdue.length + upcoming.length;
  const hasOverdue = overdue.length > 0;

  const badgeBg = hasOverdue ? "#ef444420" : "#d97706" + "20";
  const badgeText = hasOverdue ? "#ef4444" : "#d97706";

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: hasOverdue ? "#fca5a560" : colors.border }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); setCollapsed((c) => !c); }}
        style={s.cardHeader}
        activeOpacity={0.7}
      >
        <View style={[s.iconWrap, { backgroundColor: hasOverdue ? "#ef444415" : colors.primary + "15" }]}>
          <Feather name="inbox" size={15} color={hasOverdue ? "#ef4444" : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("maintenanceInbox.title")}
            </Text>
            {total > 0 && (
              <View style={[s.badge, { backgroundColor: badgeBg }]}>
                <Text style={[s.badgeText, { color: badgeText, fontFamily: "Inter_700Bold" }]}>{total}</Text>
              </View>
            )}
          </View>
          {!isLoading && (
            <Text style={[s.cardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {hasOverdue
                ? t("maintenanceInbox.summaryOverdue", { overdue: overdue.length, upcoming: upcoming.length })
                : total > 0
                ? t("maintenanceInbox.summaryUpcoming", { count: total })
                : t("maintenanceInbox.caughtUpSub")}
            </Text>
          )}
        </View>
        <Feather name={collapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Body */}
      {!collapsed && (
        <View style={[s.body, { borderTopColor: colors.border }]}>
          {isLoading ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : total === 0 ? (
            <View style={s.emptyState}>
              <Feather name="check-circle" size={28} color="#10b981" style={{ opacity: 0.7 }} />
              <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("maintenanceInbox.allCaughtUp")}
              </Text>
              <Text style={[s.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("maintenanceInbox.emptyDesc")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {overdue.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={[s.groupLabel, { color: "#ef4444", fontFamily: "Inter_600SemiBold" }]}>
                    {t("maintenanceInbox.overdue")}
                  </Text>
                  {overdue.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={true}
                      onDone={() => { Haptics.selectionAsync(); setActiveTask(task); }}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
              {upcoming.length > 0 && (
                <View style={{ gap: 6, marginTop: overdue.length > 0 ? 4 : 0 }}>
                  <Text style={[s.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("maintenanceInbox.upcoming")}
                  </Text>
                  {upcoming.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isOverdue={false}
                      onDone={() => { Haptics.selectionAsync(); setActiveTask(task); }}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Complete sheet */}
      {activeTask && (
        <CompleteSheet
          task={activeTask}
          visible={!!activeTask}
          onClose={() => setActiveTask(null)}
          onConfirm={markDone}
          colors={colors}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14 },
  cardSub: { fontSize: 11, marginTop: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  groupLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 2 },
  emptyState: { alignItems: "center", gap: 6, paddingVertical: 20 },
  emptyTitle: { fontSize: 14 },
  emptySub: { fontSize: 12, textAlign: "center", maxWidth: 240 },
});
