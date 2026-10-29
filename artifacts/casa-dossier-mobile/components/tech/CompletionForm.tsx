import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { addMonths, format, isValid, parseISO } from "date-fns";
import type { CompleteJobBody } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";
import { useColors } from "@/hooks/useColors";
import { Button, Notice, ui } from "./ui";

const NEXT_SERVICE_PRESETS = [
  { labelKey: "tech.complete.presetNone", months: 0 },
  { labelKey: "tech.complete.preset3m", months: 3 },
  { labelKey: "tech.complete.preset6m", months: 6 },
  { labelKey: "tech.complete.preset1y", months: 12 },
] as const;

function parseCost(raw: string): number | undefined | "invalid" {
  const t = raw.trim().replace(/[$,\s]/g, "");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "invalid";
}

function parseDateInput(raw: string): string | undefined | "invalid" {
  const t = raw.trim();
  if (!t) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "invalid";
  return isValid(parseISO(t)) ? t : "invalid";
}

/** "Log Completed Work" — mirrors the web portal's completion form. */
export function CompletionForm({
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (body: CompleteJobBody) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [summary, setSummary] = useState("");
  const [cost, setCost] = useState("");
  const [preset, setPreset] = useState<number | "custom">(0);
  const [customDate, setCustomDate] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const nextServiceDate =
    preset === "custom"
      ? parseDateInput(customDate)
      : preset > 0
        ? format(addMonths(new Date(), preset), "yyyy-MM-dd")
        : undefined;

  function submit() {
    setLocalError(null);
    const parsedCost = parseCost(cost);
    if (!summary.trim()) return setLocalError(t("tech.complete.errSummary"));
    if (parsedCost === "invalid") return setLocalError(t("tech.complete.errCost"));
    if (nextServiceDate === "invalid") return setLocalError(t("tech.complete.errDate"));
    Alert.alert(
      t("tech.complete.confirmTitle"),
      t("tech.complete.confirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("tech.complete.submit"),
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSubmit({ workSummary: summary.trim(), cost: parsedCost, nextServiceDate });
          },
        },
      ],
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="clipboard" size={16} color={colors.primary} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {t("tech.complete.title")}
        </Text>
      </View>
      <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {t("tech.complete.intro")}
      </Text>

      <View style={{ gap: 6 }}>
        <Text nativeID="work-summary-label" style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {t("tech.complete.whatDone")} <Text style={{ color: colors.destructive }}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel={t("tech.complete.whatDoneA11y")}
          accessibilityLabelledBy="work-summary-label"
          value={summary}
          onChangeText={setSummary}
          placeholder={t("tech.complete.whatDonePlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          style={[ui.input, styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.complete.cost")}</Text>
        <TextInput
          accessibilityLabel={t("tech.complete.costA11y")}
          value={cost}
          onChangeText={setCost}
          placeholder="0.00"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          style={[ui.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[ui.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("tech.complete.nextService")}</Text>
        <View style={styles.presetRow}>
          {NEXT_SERVICE_PRESETS.map((p) => {
            const selected = preset === p.months;
            return (
              <PresetChip key={p.labelKey} label={t(p.labelKey)} selected={selected} onPress={() => setPreset(p.months)} />
            );
          })}
          <PresetChip label={t("tech.complete.pickDate")} selected={preset === "custom"} onPress={() => setPreset("custom")} />
        </View>
        {preset === "custom" ? (
          <TextInput
            accessibilityLabel={t("tech.complete.dateA11y")}
            value={customDate}
            onChangeText={setCustomDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            style={[ui.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
          />
        ) : typeof nextServiceDate === "string" ? (
          <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("tech.complete.nextServiceOn", { date: formatDate(parseISO(nextServiceDate), "MMM d, yyyy") })}
          </Text>
        ) : null}
      </View>

      {(localError || error) && <Notice tone="error" message={(localError ?? error)!} />}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={t("common.cancel")} variant="outline" onPress={onCancel} disabled={submitting} style={{ flex: 1 }} />
        <Button
          label={submitting ? t("tech.complete.completing") : t("tech.complete.submit")}
          icon="check-circle"
          onPress={submit}
          loading={submitting}
          disabled={!summary.trim()}
          style={{ flex: 1.4 }}
        />
      </View>
      <Text style={[styles.footnote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {t("tech.complete.footnote")}
      </Text>
    </View>
  );
}

function PresetChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("tech.complete.presetA11y", { label })}
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.7}
      style={[
        styles.preset,
        { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
      ]}
    >
      <Text style={[styles.presetText, { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15 },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  presetText: { fontSize: 13 },
  footnote: { fontSize: 11, textAlign: "center" },
});
