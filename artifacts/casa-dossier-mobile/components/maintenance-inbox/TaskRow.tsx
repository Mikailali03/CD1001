import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { differenceInCalendarDays } from "date-fns";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { CATEGORY_ICONS, dueDateLabel, type InboxTask } from "./helpers";

// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: InboxTask;
  isOverdue: boolean;
  onDone: () => void;
  colors: ReturnType<typeof useColors>;
}

export function TaskRow({ task, isOverdue, onDone, colors }: TaskRowProps) {
  const { t } = useTranslation();
  const dateLabel = dueDateLabel(task.nextDueDate, isOverdue);
  const icon = CATEGORY_ICONS[task.assetCategory] ?? "📦";
  const dateColor = isOverdue ? "#ef4444" : differenceInCalendarDays(new Date(task.nextDueDate + "T00:00:00"), new Date()) <= 7 ? "#d97706" : colors.mutedForeground;

  return (
    <View style={[tr.row, { backgroundColor: isOverdue ? "#fef2f218" : colors.card, borderColor: isOverdue ? "#fca5a540" : colors.border }]}>
      <Text style={tr.emoji}>{icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Text style={[tr.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1 }]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.isDiy && (
            <View style={[tr.diyBadge, { backgroundColor: colors.muted }]}>
              <Text style={[tr.diyText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{t("common.diy")}</Text>
            </View>
          )}
        </View>
        <Text style={[tr.assetName, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
          {task.assetName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
          <Feather name={isOverdue ? "alert-circle" : "calendar"} size={11} color={dateColor} />
          <Text style={[tr.dateLabel, { color: dateColor, fontFamily: "Inter_500Medium" }]}>
            {dateLabel}
          </Text>
          {task.estimatedCost && (
            <Text style={[tr.cost, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("maintenanceInbox.estCost", { amount: Number(task.estimatedCost).toLocaleString() })}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={onDone}
        style={[tr.doneBtn, { backgroundColor: colors.primary + "18" }]}
        activeOpacity={0.7}
      >
        <Feather name="check-circle" size={14} color={colors.primary} />
        <Text style={[tr.doneBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.done")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const tr = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  emoji: { fontSize: 18, marginTop: 1 },
  title: { fontSize: 13, lineHeight: 18 },
  assetName: { fontSize: 11 },
  dateLabel: { fontSize: 11 },
  cost: { fontSize: 11 },
  diyBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  diyText: { fontSize: 9, letterSpacing: 0.5 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  doneBtnText: { fontSize: 12 },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
