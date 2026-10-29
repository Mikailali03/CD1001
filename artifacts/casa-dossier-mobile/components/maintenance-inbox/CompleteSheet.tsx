import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { CATEGORY_ICONS, dueDateLabel, type CompletePayload, type InboxTask } from "./helpers";

// ---------------------------------------------------------------------------
// Complete task bottom sheet
// ---------------------------------------------------------------------------

interface CompleteSheetProps {
  task: InboxTask;
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: CompletePayload) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  insetBottom: number;
}

export function CompleteSheet({ task, visible, onClose, onConfirm, colors }: Omit<CompleteSheetProps, "insetBottom">) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(task.isDiy ?? true);
  const [techName, setTechName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm({
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        // Stored value, same constant as the web app — not translated
        technicianName: isDiy ? "Homeowner (DIY)" : (techName.trim() || undefined),
        companyName: isDiy ? undefined : (company.trim() || undefined),
      });
      setNotes(""); setCost(""); setTechName(""); setCompany("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={[cs.fullScreen, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[cs.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[cs.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                {task.title}
              </Text>
              <Text style={[cs.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {task.assetName}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={8} onPress={onClose} style={[cs.closeBtn, { backgroundColor: colors.muted }]} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 24 }}>
            {/* Notes */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.notesOptional")}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("maintenanceInbox.notesPlaceholder", { task: task.title.toLowerCase() })}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[cs.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
              />
            </View>

            {/* Cost */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.actualCost")}</Text>
              <View style={[cs.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[cs.currencyPrefix, { color: colors.mutedForeground }]}>$</Text>
                <TextInput
                  value={cost}
                  onChangeText={setCost}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[cs.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1 }]}
                />
              </View>
            </View>

            {/* DIY / Pro toggle */}
            <View style={{ gap: 6 }}>
              <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.whoDidWork")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setIsDiy(true)}
                  style={[cs.toggleBtn, { borderColor: isDiy ? colors.primary : colors.border, backgroundColor: isDiy ? colors.primary + "15" : colors.card }]}
                  activeOpacity={0.7}
                >
                  <Feather name="tool" size={14} color={isDiy ? colors.primary : colors.mutedForeground} />
                  <Text style={[cs.toggleText, { color: isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("maintenanceInbox.didItMyself")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsDiy(false)}
                  style={[cs.toggleBtn, { borderColor: !isDiy ? colors.primary : colors.border, backgroundColor: !isDiy ? colors.primary + "15" : colors.card }]}
                  activeOpacity={0.7}
                >
                  <Feather name="user-check" size={14} color={!isDiy ? colors.primary : colors.mutedForeground} />
                  <Text style={[cs.toggleText, { color: !isDiy ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("maintenanceInbox.hiredPro")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pro fields */}
            {!isDiy && (
              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.technicianName")}</Text>
                  <TextInput
                    value={techName}
                    onChangeText={setTechName}
                    placeholder={t("maintenanceInbox.namePlaceholder")}
                    placeholderTextColor={colors.mutedForeground}
                    style={[cs.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={[cs.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("maintenanceInbox.company")}</Text>
                  <TextInput
                    value={company}
                    onChangeText={setCompany}
                    placeholder={t("maintenanceInbox.companyPlaceholder")}
                    placeholderTextColor={colors.mutedForeground}
                    style={[cs.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
              </View>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={busy}
              style={[cs.confirmBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Feather name="check-circle" size={16} color={colors.primaryForeground} />
              )}
              <Text style={[cs.confirmText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                {busy ? t("common.saving") : t("maintenanceInbox.markComplete")}
              </Text>
            </TouchableOpacity>
          </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  fullScreen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 15 },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12 },
  textarea: {
    borderWidth: 1, borderRadius: 10, padding: 10,
    minHeight: 72, textAlignVertical: "top", fontSize: 13,
  },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  currencyPrefix: { fontSize: 13, paddingRight: 4 },
  textInput: { fontSize: 13, paddingVertical: 10 },
  inputField: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 9 },
  toggleText: { fontSize: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  confirmText: { fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Task row
