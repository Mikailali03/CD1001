import React, { useState } from "react";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { completeMaintenanceTask } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { differenceInCalendarDays } from "date-fns";
import { formatDate } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import type { MaintenanceTask } from "./types";

// ── Mark Complete Modal ────────────────────────────────────────────────────────
export function MarkCompleteModal({
  task, assetId, visible, onClose, onSuccess, colors,
}: {
  task: MaintenanceTask | null; assetId: string; visible: boolean;
  onClose: () => void; onSuccess: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task?.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(task?.isDiy ?? true);
  const [techName, setTechName] = useState(task?.isDiy !== false ? "Homeowner (DIY)" : "");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleComplete() {
    if (!task) return;
    setBusy(true);
    try {
      await completeMaintenanceTask(task.id, {
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: techName.trim() || undefined,
        companyName: company.trim() || undefined,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch {
      Alert.alert(t("common.error"), t("markComplete.failed"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  const insets = useSafeAreaInsets();

  if (!task) return null;

  const diff = differenceInCalendarDays(new Date(task.nextDueDate), new Date());
  const isOverdue = diff < 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={[modalStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[modalStyles.urgencyBadge, {
                  backgroundColor: isOverdue ? colors.destructive + "15" : "#fef3c7",
                }]}>
                  <Feather name={isOverdue ? "alert-circle" : "clock"} size={11} color={isOverdue ? colors.destructive : "#d97706"} />
                  <Text style={[modalStyles.urgencyText, { color: isOverdue ? colors.destructive : "#d97706", fontFamily: "Inter_600SemiBold" }]}>
                    {isOverdue ? t("assetDetail.due.overdue", { days: Math.abs(diff) }) : diff === 0 ? t("assetDetail.due.today") : t("assetDetail.due.on", { date: formatDate(task.nextDueDate, "MMM d") })}
                  </Text>
                </View>
                {task.isDiy && (
                  <View style={[modalStyles.urgencyBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[modalStyles.urgencyText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.diy")}</Text>
                  </View>
                )}
              </View>
              <Text style={[modalStyles.taskTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {task.title}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={modalStyles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={modalStyles.body}>
            {/* Task description / steps */}
            {task.description ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={[modalStyles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {t("markComplete.howTo")}
                </Text>
                <Text style={[modalStyles.stepsText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {task.description}
                </Text>
              </View>
            ) : null}

            <View style={[modalStyles.divider, { backgroundColor: colors.border }]} />

            {/* Completion form */}
            <Text style={[modalStyles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold", marginTop: 20 }]}>
              {t("markComplete.sectionTitle")}
            </Text>

            {/* Notes */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("markComplete.notesOptional")}</Text>
            <TextInput
              style={[modalStyles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("markComplete.notesPlaceholder", { title: task.title.toLowerCase() })}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />

            {/* Cost */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 14 }]}>{t("markComplete.actualCostOptional")}</Text>
            <TextInput
              style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />

            {/* DIY / Pro toggle */}
            <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 14 }]}>{t("markComplete.whoDidIt")}</Text>
            <View style={modalStyles.toggleRow}>
              <TouchableOpacity
                style={[modalStyles.toggle, isDiy ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setIsDiy(true); setTechName("Homeowner (DIY)"); }}
              >
                <Feather name="tool" size={14} color={isDiy ? colors.primaryForeground : colors.foreground} />
                <Text style={[modalStyles.toggleText, { color: isDiy ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("markComplete.myself")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.toggle, !isDiy ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => { setIsDiy(false); setTechName(""); }}
              >
                <Feather name="user-check" size={14} color={!isDiy ? colors.primaryForeground : colors.foreground} />
                <Text style={[modalStyles.toggleText, { color: !isDiy ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("markComplete.hiredPro")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pro fields */}
            {!isDiy && (
              <View style={{ gap: 10, marginTop: 10 }}>
                <View>
                  <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("markComplete.technicianName")}</Text>
                  <TextInput
                    style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
                    value={techName} onChangeText={setTechName}
                    placeholder={t("markComplete.namePlaceholder")} placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View>
                  <Text style={[modalStyles.fieldLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("markComplete.company")}</Text>
                  <TextInput
                    style={[modalStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
                    value={company} onChangeText={setCompany}
                    placeholder={t("markComplete.companyPlaceholder")} placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            )}
          </KeyboardAwareScrollViewCompat>

          {/* Footer */}
          <View style={[modalStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[modalStyles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose} disabled={busy}
            >
              <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.completeBtn, { opacity: busy ? 0.6 : 1 }]}
              onPress={handleComplete} disabled={busy} activeOpacity={0.8}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="check-circle" size={15} color="#fff" />
                  <Text style={[{ fontSize: 14, color: "#fff", fontFamily: "Inter_600SemiBold" }]}>{t("markComplete.submit")}</Text></>
              }
            </TouchableOpacity>
          </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, borderBottomWidth: 1 },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  urgencyText: { fontSize: 11 },
  taskTitle: { fontSize: 17, lineHeight: 22 },
  closeBtn: { padding: 4, marginTop: 2 },
  body: { padding: 20, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  stepsText: { fontSize: 14, lineHeight: 22 },
  divider: { height: 1 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  textArea: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, height: 44 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  toggleText: { fontSize: 13 },
  footer: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 20, borderTopWidth: 1 },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 12, borderWidth: 1 },
  completeBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 12, backgroundColor: "#059669" },
});
