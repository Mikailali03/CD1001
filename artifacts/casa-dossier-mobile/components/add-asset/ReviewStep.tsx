import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { AssetPhotoField } from "./AssetPhotoField";
import { s } from "./styles";
import { CATEGORIES, CATEGORY_EMOJIS, type AssetForm, type ScanResult } from "./types";

// ── Review / edit the asset's fields, then save ───────────────────────────────
export function ReviewStep({
  form, setField, scanResult, fieldsFilled, saveBusy, onSave,
  photoUri, photoUploading, onTakePhoto, onPickPhoto, onRemovePhoto,
  bottomInset, colors,
}: {
  form: AssetForm;
  setField: <K extends keyof AssetForm>(key: K, value: AssetForm[K]) => void;
  scanResult: ScanResult | null;
  fieldsFilled: number;
  saveBusy: boolean;
  onSave: () => void;
  photoUri: string | null;
  photoUploading: boolean;
  onTakePhoto: () => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  bottomInset: number;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [categoryOpen, setCategoryOpen] = useState(false);
  return (
    <>
      {/* AI success banner */}
      {scanResult && (
        <View style={[s.aiBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
          <Feather name="zap" size={14} color="#16a34a" />
          <View style={{ flex: 1 }}>
            <Text style={[s.aiBannerTitle, { color: "#15803d", fontFamily: "Inter_600SemiBold" }]}>
              {t("addAsset.extractedFields", { count: fieldsFilled + (scanResult.manufactureDate ? 1 : 0) + (scanResult.estimatedReplacementCost ? 1 : 0) })}
            </Text>
            <Text style={[s.aiBannerSub, { color: "#16a34a", fontFamily: "Inter_400Regular" }]}>
              {t("addAsset.reviewBeforeSaving")}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 100, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={{ gap: 6 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("addAsset.nameLabel")} <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <TextInput
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder={t("addAsset.namePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            autoFocus
          />
        </View>

        {/* Category picker */}
        <View style={{ gap: 6 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.categoryLabel")}</Text>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setCategoryOpen((o) => !o); }}
            style={[s.input, s.pickerRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[{ fontSize: 15 }]}>{CATEGORY_EMOJIS[form.category]}</Text>
            <Text style={[s.pickerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{t(`categories.${form.category}`, { defaultValue: form.category })}</Text>
            <Feather name={categoryOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {categoryOpen && (
            <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: c === form.category }}
                  key={c}
                  onPress={() => { Haptics.selectionAsync(); setField("category", c); setCategoryOpen(false); }}
                  style={[s.dropdownItem, { borderBottomColor: colors.border, backgroundColor: c === form.category ? colors.primary + "12" : "transparent" }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>{CATEGORY_EMOJIS[c]}</Text>
                  <Text style={[s.dropdownText, { color: colors.foreground, fontFamily: c === form.category ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{t(`categories.${c}`, { defaultValue: c })}</Text>
                  {c === form.category && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Brand + Model */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.brandLabel")}</Text>
              {scanResult?.brand && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiTag")}</Text>}
            </View>
            <TextInput
              value={form.brand}
              onChangeText={(v) => setField("brand", v)}
              placeholder={t("addAsset.brandPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.brand ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.modelLabel")}</Text>
              {scanResult?.model && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiTag")}</Text>}
            </View>
            <TextInput
              value={form.model}
              onChangeText={(v) => setField("model", v)}
              placeholder={t("addAsset.modelPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.model ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
            />
          </View>
        </View>

        {/* Serial number */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.serialLabel")}</Text>
            {scanResult?.serialNumber && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiTag")}</Text>}
          </View>
          <TextInput
            value={form.serialNumber}
            onChangeText={(v) => setField("serialNumber", v)}
            placeholder={t("addAsset.serialPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.serialNumber ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
          />
        </View>

        {/* Install date + Replacement cost */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.installDateLabel")}</Text>
              {scanResult?.manufactureDate && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiTag")}</Text>}
            </View>
            <TextInput
              value={form.installDate}
              onChangeText={(v) => setField("installDate", v)}
              placeholder={t("addAsset.monthPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.manufactureDate ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.costLabel")}</Text>
              {scanResult?.estimatedReplacementCost != null && <Text style={[s.aiTag, { color: "#16a34a", fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.aiTag")}</Text>}
            </View>
            <TextInput
              value={form.replacementCost}
              onChangeText={(v) => setField("replacementCost", v)}
              placeholder={t("addAsset.costPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: scanResult?.estimatedReplacementCost != null ? "#bbf7d0" : colors.border, fontFamily: "Inter_400Regular" }]}
            />
          </View>
        </View>

        {/* Warranty expiry */}
        <View style={{ gap: 6 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{t("addAsset.warrantyLabel")}</Text>
          <TextInput
            value={form.warrantyExpiry}
            onChangeText={(v) => setField("warrantyExpiry", v)}
            placeholder={t("addAsset.monthOptionalPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            style={[s.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
          />
        </View>

        <AssetPhotoField
          photoUri={photoUri}
          uploading={photoUploading}
          onTake={onTakePhoto}
          onPick={onPickPhoto}
          onRemove={onRemovePhoto}
          colors={colors}
        />
      </ScrollView>

      {/* Save button fixed at bottom */}
      <View style={[s.saveBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomInset + 12 }]}>
        <TouchableOpacity
          onPress={onSave}
          disabled={!form.name.trim() || saveBusy}
          style={[s.saveBtn, { backgroundColor: colors.primary, opacity: (!form.name.trim() || saveBusy) ? 0.5 : 1 }]}
          activeOpacity={0.85}
        >
          <Feather name="zap" size={18} color={colors.primaryForeground} />
          <Text style={[s.saveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>{t("addAsset.saveAndGenerate")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
