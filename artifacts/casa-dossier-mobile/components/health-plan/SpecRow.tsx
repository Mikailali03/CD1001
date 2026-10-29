import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { addDays } from "date-fns";
import { formatDate } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import type { MaintenanceSpec } from "@workspace/maintenance-specs";
import { useColors } from "@/hooks/useColors";
import { Trans, useTranslation } from "react-i18next";
import { CompletionForm } from "./CompletionForm";
import { PRIORITY_BG, PRIORITY_COLOR, type CompletePayload } from "./types";

// ── Spec row ──────────────────────────────────────────────────────────────────
export function SpecRow({
  spec,
  assetId,
  assetName,
  done,
  onMarkDone,
  colors,
}: {
  spec: MaintenanceSpec;
  assetId: string;
  assetName: string;
  done: boolean;
  onMarkDone: (assetId: string, spec: MaintenanceSpec, payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const nextDueAfter = addDays(new Date(), spec.intervalDays);

  const intervalLabel =
    spec.intervalDays < 60
      ? t("healthPlan.everyDays", { count: spec.intervalDays })
      : spec.intervalDays < 400
      ? t("healthPlan.everyMonths", { count: Math.round(spec.intervalDays / 30) })
      : t("healthPlan.everyYears", { count: Math.round(spec.intervalDays / 365) });

  if (done) {
    return (
      <View style={[sr.donePill, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
        <Feather name="check-circle" size={14} color="#16a34a" />
        <View style={{ flex: 1 }}>
          <Text style={[sr.doneTitle, { color: "#15803d", fontFamily: "Inter_500Medium" }]} numberOfLines={1}>{spec.title}</Text>
          <Text style={[sr.doneSub, { color: "#16a34a", fontFamily: "Inter_400Regular" }]}>
            {t("healthPlan.nextDueNowTracked", { date: formatDate(nextDueAfter, "PP") })}
          </Text>
        </View>
        <Text style={[sr.doneBadge, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.doneCheck")}</Text>
      </View>
    );
  }

  return (
    <View style={[sr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sr.cardTop}>
        <Feather name={spec.isDiy ? "tool" : "user-check"} size={14} color={spec.isDiy ? colors.primary : colors.mutedForeground} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[sr.title, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{spec.title}</Text>
          <Text style={[sr.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {assetName} · {intervalLabel}{spec.estimatedMinutes ? ` · ${t("healthPlan.aboutMinutes", { count: spec.estimatedMinutes })}` : ""}
          </Text>
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          <View style={[sr.priorityBadge, { backgroundColor: PRIORITY_BG[spec.priority] }]}>
            <Text style={[sr.priorityText, { color: PRIORITY_COLOR[spec.priority], fontFamily: "Inter_600SemiBold" }]}>{t(`healthPlan.priority.${spec.priority}`, { defaultValue: spec.priority })}</Text>
          </View>
          <View style={[sr.typeBadge, { backgroundColor: spec.isDiy ? colors.primary + "15" : colors.muted }]}>
            <Text style={[sr.typeText, { color: spec.isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {spec.isDiy ? t("common.diy") : t("common.pro")}
            </Text>
          </View>
        </View>
      </View>

      {/* Due note */}
      <View style={[sr.dueRow, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
        <Feather name="calendar" size={11} color="#d97706" />
        <Text style={[sr.dueMeta, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
          <Trans
            i18nKey="healthPlan.recommendedNowNextDue"
            values={{ date: formatDate(nextDueAfter, "PP") }}
            components={{ bold: <Text style={{ fontFamily: "Inter_600SemiBold" }} /> }}
          />
        </Text>
      </View>

      <Text style={[sr.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
        {spec.description}
      </Text>

      <View style={sr.actions}>
        {(spec.steps?.length ?? 0) > 0 && (
          <TouchableOpacity onPress={() => setStepsOpen((o) => !o)} style={sr.stepsLink} activeOpacity={0.7}>
            <Feather name={stepsOpen ? "chevron-down" : "chevron-right"} size={12} color={colors.primary} />
            <Text style={[sr.stepsText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {stepsOpen ? t("healthPlan.hideSteps") : t("healthPlan.showSteps", { count: spec.steps!.length })}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setExpanded((e) => !e); }}
          style={[sr.doneBtn, { borderColor: "#86efac" }]}
          activeOpacity={0.7}
        >
          <Feather name="check" size={12} color="#16a34a" />
          <Text style={[sr.doneBtnText, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("healthPlan.done")}</Text>
        </TouchableOpacity>
      </View>

      {stepsOpen && (spec.steps?.length ?? 0) > 0 && (
        <View style={{ gap: 4, marginTop: 4 }}>
          {spec.steps!.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 6 }}>
              <Text style={[sr.stepNum, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{i + 1}.</Text>
              <Text style={[sr.stepText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{step}</Text>
            </View>
          ))}
          {spec.toolsNeeded && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
              <Text style={[sr.toolsLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{t("healthPlan.tools")}</Text>
              {spec.toolsNeeded.map((t) => (
                <View key={t} style={[sr.toolChip, { backgroundColor: colors.muted }]}>
                  <Text style={[sr.toolText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {spec.safetyNotes && (
            <View style={[sr.safetyBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Text style={[sr.safetyText, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>⚠️ {spec.safetyNotes}</Text>
            </View>
          )}
        </View>
      )}

      {expanded && (
        <CompletionForm
          isDiyDefault={spec.isDiy}
          titleHint={spec.title}
          onDone={(payload) => onMarkDone(assetId, spec, payload)}
          onCancel={() => setExpanded(false)}
          colors={colors}
        />
      )}
    </View>
  );
}

const sr = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 2 },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  priorityText: { fontSize: 9, textTransform: "uppercase" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  typeText: { fontSize: 9 },
  dueRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 },
  dueMeta: { fontSize: 11, flex: 1, lineHeight: 16 },
  desc: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepsLink: { flexDirection: "row", alignItems: "center", gap: 3 },
  stepsText: { fontSize: 12 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, marginLeft: "auto" },
  doneBtnText: { fontSize: 11 },
  stepNum: { fontSize: 12, width: 14 },
  stepText: { fontSize: 12, lineHeight: 17, flex: 1 },
  toolsLabel: { fontSize: 10 },
  toolChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  toolText: { fontSize: 10 },
  safetyBox: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  safetyText: { fontSize: 11, lineHeight: 16 },
  donePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  doneTitle: { fontSize: 13 },
  doneSub: { fontSize: 11, marginTop: 1 },
  doneBadge: { fontSize: 10 },
});
