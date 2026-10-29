import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateServiceRecord } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

// ── Log Service Record form ────────────────────────────────────────────────────
export function LogServiceForm({ assetId, colors, onSuccess }: { assetId: string; colors: ReturnType<typeof useColors>; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [isDiy, setIsDiy] = useState(true);
  const [techName, setTechName] = useState("Homeowner (DIY)");
  const [company, setCompany] = useState("");
  const [cost, setCost] = useState("");

  const { mutate, isPending } = useCreateServiceRecord();

  function reset() {
    setDescription(""); setDate(new Date().toLocaleDateString("en-CA"));
    setIsDiy(true); setTechName("Homeowner (DIY)"); setCompany(""); setCost("");
  }

  function submit() {
    if (!description.trim()) {
      Alert.alert(t("logService.requiredTitle"), t("logService.requiredMessage"));
      return;
    }
    mutate({
      assetId,
      data: {
        description: description.trim(),
        date,
        technicianName: techName.trim() || undefined,
        companyName: company.trim() || undefined,
        cost: cost ? parseFloat(cost) : undefined,
      },
    }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reset(); setOpen(false); onSuccess();
      },
      onError: () => Alert.alert(t("common.error"), t("logService.saveFailed")),
    });
  }

  if (!open) {
    return (
      <TouchableOpacity
        style={[logStyles.trigger, { borderColor: colors.primary + "50", backgroundColor: colors.card }]}
        onPress={() => setOpen(true)}
      >
        <View style={[logStyles.triggerIcon, { borderColor: colors.primary + "50" }]}>
          <Feather name="plus" size={14} color={colors.primary} />
        </View>
        <Text style={[logStyles.triggerText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
          {t("logService.cta")}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[logStyles.form, { borderColor: colors.primary + "30", backgroundColor: colors.card }]}>
      <View style={[logStyles.formHeader, { borderBottomColor: colors.primary + "20", backgroundColor: colors.primary + "08" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={[logStyles.formTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{t("logService.newTitle")}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("logService.cancelNew")} hitSlop={14} onPress={() => { setOpen(false); reset(); }}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={logStyles.formBody}>
        <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {t("logService.whatWasDone")} <Text style={{ color: colors.destructive }}>*</Text>
        </Text>
        <TextInput
          style={[logStyles.textArea, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
          value={description} onChangeText={setDescription}
          placeholder={t("logService.descPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          multiline numberOfLines={3}
        />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("logService.date")}</Text>
            <TextInput
              style={[logStyles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={date} onChangeText={setDate} placeholder={t("logService.datePlaceholder")} placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[logStyles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("logService.cost")}</Text>
            <TextInput
              style={[logStyles.input, { borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={cost} onChangeText={setCost} placeholder="0.00"
              placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* DIY / Pro toggle */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[true, false].map((diy) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isDiy === diy }}
              key={String(diy)}
              style={[
                logStyles.toggle,
                isDiy === diy
                  ? { backgroundColor: colors.primary }
                  : { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.background },
              ]}
              onPress={() => { setIsDiy(diy); setTechName(diy ? "Homeowner (DIY)" : ""); }}
            >
              <Feather name={diy ? "tool" : "user-check"} size={12} color={isDiy === diy ? colors.primaryForeground : colors.foreground} />
              <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold" }, { color: isDiy === diy ? colors.primaryForeground : colors.foreground }]}>
                {diy ? t("common.diy") : t("logService.hirePro")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!isDiy && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TextInput
              style={[logStyles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={techName} onChangeText={setTechName} placeholder={t("logService.technician")} placeholderTextColor={colors.mutedForeground}
            />
            <TextInput
              style={[logStyles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular", backgroundColor: colors.background }]}
              value={company} onChangeText={setCompany} placeholder={t("logService.company")} placeholderTextColor={colors.mutedForeground}
            />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            style={[logStyles.cancelBtn, { borderColor: colors.border }]}
            onPress={() => { setOpen(false); reset(); }} disabled={isPending}
          >
            <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[logStyles.saveBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
            onPress={submit} disabled={isPending} activeOpacity={0.8}
          >
            {isPending
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.primaryForeground }]}>{t("logService.save")}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const logStyles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", paddingHorizontal: 14 },
  triggerIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  triggerText: { fontSize: 14 },
  form: { borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  formTitle: { fontSize: 14 },
  formBody: { padding: 14 },
  label: { fontSize: 12, marginBottom: 6 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 70, textAlignVertical: "top" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, height: 40 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
});
