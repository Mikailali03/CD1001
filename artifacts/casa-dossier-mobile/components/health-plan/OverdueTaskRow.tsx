import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatDate } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { CompletionForm } from "./CompletionForm";
import type { CompletePayload, OverdueTask } from "./types";

// ── Overdue task row ──────────────────────────────────────────────────────────
export function OverdueTaskRow({
  task,
  done,
  onMarkDone,
  colors,
}: {
  task: OverdueTask;
  done: boolean;
  onMarkDone: (id: string, payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(task.nextDueDate).getTime()) / 86400000));

  if (done) {
    return (
      <View style={[tr.donePill, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
        <Feather name="check-circle" size={14} color="#16a34a" />
        <Text style={[tr.doneText, { color: "#15803d", fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={[tr.doneBadge, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.doneCheck")}</Text>
      </View>
    );
  }

  return (
    <View style={[tr.card, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
      <View style={tr.cardTop}>
        <Feather name="alert-circle" size={15} color="#dc2626" style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[tr.title, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{task.title}</Text>
          <Text style={[tr.meta, { color: "#dc2626", fontFamily: "Inter_400Regular" }]}>
            {task.assetName
              ? t("healthPlan.overdueMetaWithAsset", { asset: task.assetName, count: daysOverdue, date: formatDate(task.nextDueDate, "PP") })
              : t("healthPlan.overdueMeta", { count: daysOverdue, date: formatDate(task.nextDueDate, "PP") })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setExpanded((e) => !e); }}
          style={[tr.doneBtn, { borderColor: "#86efac" }]}
          activeOpacity={0.7}
        >
          <Feather name="check" size={12} color="#16a34a" />
          <Text style={[tr.doneBtnText, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.done")}</Text>
        </TouchableOpacity>
      </View>
      {expanded && (
        <CompletionForm
          isDiyDefault={task.isDiy ?? true}
          estimatedCost={task.estimatedCost}
          titleHint={task.title}
          onDone={(payload) => onMarkDone(task.id, payload)}
          onCancel={() => setExpanded(false)}
          colors={colors}
        />
      )}
    </View>
  );
}

const tr = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 0 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 2 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  doneBtnText: { fontSize: 11 },
  donePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  doneText: { flex: 1, fontSize: 13 },
  doneBadge: { fontSize: 10 },
});
