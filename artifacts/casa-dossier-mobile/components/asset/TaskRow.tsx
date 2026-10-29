import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { differenceInCalendarDays } from "date-fns";
import { formatDate } from "@/lib/dates";
import type { MaintenanceTask } from "./types";

// ── Task row ──────────────────────────────────────────────────────────────────
export function TaskRow({ task, assetId, colors, onMarkDone }: { task: MaintenanceTask; assetId: string; colors: ReturnType<typeof useColors>; onMarkDone: (task: MaintenanceTask) => void }) {
  const { t } = useTranslation();
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), new Date());
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const dueLabelColor = isOverdue ? colors.destructive : isSoon ? "#d97706" : colors.mutedForeground;
  const dueLabel = isOverdue
    ? t("assetDetail.due.overdue", { days: Math.abs(diff) })
    : diff === 0 ? t("assetDetail.due.today")
    : diff === 1 ? t("assetDetail.due.tomorrow")
    : t("assetDetail.due.on", { date: formatDate(task.nextDueDate, "MMM d, yyyy") });

  return (
    <View style={[
      taskStyles.wrap,
      {
        borderColor: isOverdue ? colors.destructive + "33" : colors.border,
        backgroundColor: isOverdue ? colors.destructive + "06" : colors.card,
      },
    ]}>
      <View style={taskStyles.left}>
        <Text style={[taskStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {task.title}
        </Text>
        {task.description ? (
          <Text style={[taskStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
        <View style={taskStyles.metaRow}>
          <Feather name={isOverdue ? "alert-circle" : "clock"} size={11} color={dueLabelColor} />
          <Text style={[taskStyles.due, { color: dueLabelColor, fontFamily: "Inter_500Medium" }]}>{dueLabel}</Text>
          {task.intervalDays ? (
            <Text style={[taskStyles.interval, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("assetDetail.due.everyInline", { days: task.intervalDays })}
            </Text>
          ) : null}
          {task.isDiy ? (
            <View style={[taskStyles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[taskStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.diy")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={taskStyles.doneBtn}
        onPress={() => onMarkDone(task)}
        activeOpacity={0.7}
      >
        <Feather name="check-circle" size={13} color="#059669" />
        <Text style={[taskStyles.doneBtnText, { fontFamily: "Inter_600SemiBold" }]}>{t("assetDetail.markDone")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const taskStyles = StyleSheet.create({
  wrap: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 6 },
  left: { gap: 3 },
  title: { fontSize: 13, lineHeight: 18 },
  desc: { fontSize: 12, lineHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 2 },
  due: { fontSize: 11 },
  interval: { fontSize: 11 },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9 },
  doneBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end",
    backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#6ee7b7",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  doneBtnText: { fontSize: 12, color: "#059669" },
});
