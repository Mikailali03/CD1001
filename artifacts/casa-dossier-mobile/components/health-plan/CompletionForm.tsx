import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import type { CompletePayload } from "./types";

// ── Inline completion form ────────────────────────────────────────────────────
export function CompletionForm({
  isDiyDefault,
  estimatedCost,
  titleHint,
  onDone,
  onCancel,
  colors,
}: {
  isDiyDefault: boolean;
  estimatedCost?: string | number | null;
  titleHint: string;
  onDone: (payload: CompletePayload) => Promise<void>;
  onCancel: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(estimatedCost ? String(Number(estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState(isDiyDefault);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onDone({
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        // Stored value, same constant as the web app — not translated
        technicianName: isDiy ? "Homeowner (DIY)" : undefined,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[cf.wrap, { backgroundColor: colors.muted + "80", borderColor: colors.border }]}>
      {/* DIY toggle */}
      <View style={cf.toggleRow}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setIsDiy(true); }}
          style={[cf.toggleBtn, { backgroundColor: isDiy ? "#3d7a5f18" : colors.card, borderColor: isDiy ? "#3d7a5f60" : colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="tool" size={13} color={isDiy ? "#3d7a5f" : colors.mutedForeground} />
          <Text style={[cf.toggleText, { color: isDiy ? "#3d7a5f" : colors.mutedForeground, fontFamily: isDiy ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{t("common.diy")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setIsDiy(false); }}
          style={[cf.toggleBtn, { backgroundColor: !isDiy ? colors.primary + "18" : colors.card, borderColor: !isDiy ? colors.primary + "60" : colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="user" size={13} color={!isDiy ? colors.primary : colors.mutedForeground} />
          <Text style={[cf.toggleText, { color: !isDiy ? colors.primary : colors.mutedForeground, fontFamily: !isDiy ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{t("common.pro")}</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t("healthPlan.notesFor", { task: titleHint.toLowerCase() })}
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={2}
        style={[cf.input, cf.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
      />

      {/* Cost */}
      <TextInput
        value={cost}
        onChangeText={setCost}
        placeholder={t("healthPlan.actualCostOptional")}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        style={[cf.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
      />

      {/* Buttons */}
      <View style={cf.btnRow}>
        <TouchableOpacity onPress={onCancel} style={[cf.cancelBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
          <Text style={[cf.cancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{t("common.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={submit}
          disabled={busy}
          style={[cf.submitBtn, { backgroundColor: "#3d7a5f", opacity: busy ? 0.6 : 1 }]}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={14} color="#fff" />}
          <Text style={[cf.submitText, { fontFamily: "Inter_600SemiBold" }]}>{busy ? t("common.saving") : t("healthPlan.markDone")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cf = StyleSheet.create({
  wrap: { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8, gap: 8 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingVertical: 8 },
  toggleText: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  textarea: { minHeight: 56, textAlignVertical: "top" },
  btnRow: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, paddingVertical: 9 },
  cancelText: { fontSize: 13 },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, paddingVertical: 9 },
  submitText: { color: "#fff", fontSize: 13 },
});
