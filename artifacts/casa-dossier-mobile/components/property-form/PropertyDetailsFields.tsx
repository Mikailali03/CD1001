import React from "react";
import { View, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import type { FormState } from "@/components/PropertyFormModal";
import { fStyles } from "./styles";

// ── Name, address and basic facts ─────────────────────────────────────────────
export function PropertyDetailsFields({
  form, set, colors,
}: {
  form: FormState;
  set: (key: keyof FormState, value: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const inputStyle = [
    fStyles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" },
  ];
  const labelStyle = [fStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }];

  return (
    <>
      {/* Name */}
      <View style={fStyles.field}>
        <Text style={labelStyle}>{t("propertyForm.nameLabel")}</Text>
        <TextInput
          style={inputStyle}
          value={form.name}
          onChangeText={(v) => set("name", v)}
          placeholder={t("propertyForm.namePlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
        />
      </View>

      {/* Address */}
      <View style={fStyles.field}>
        <Text style={labelStyle}>{t("propertyForm.addressLabel")}</Text>
        <TextInput
          style={inputStyle}
          value={form.address}
          onChangeText={(v) => set("address", v)}
          placeholder={t("propertyForm.addressPlaceholder")}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
        />
      </View>

      {/* City + State */}
      <View style={fStyles.row}>
        <View style={[fStyles.field, { flex: 2 }]}>
          <Text style={labelStyle}>{t("propertyForm.city")}</Text>
          <TextInput
            style={inputStyle}
            value={form.city}
            onChangeText={(v) => set("city", v)}
            placeholder={t("propertyForm.cityPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
          />
        </View>
        <View style={[fStyles.field, { flex: 1 }]}>
          <Text style={labelStyle}>{t("propertyForm.state")}</Text>
          <TextInput
            style={inputStyle}
            value={form.state}
            onChangeText={(v) => set("state", v.toUpperCase())}
            placeholder="TX"
            placeholderTextColor={colors.mutedForeground}
            maxLength={2}
            autoCapitalize="characters"
            returnKeyType="next"
          />
        </View>
      </View>

      {/* ZIP */}
      <View style={fStyles.field}>
        <Text style={labelStyle}>{t("propertyForm.zip")}</Text>
        <TextInput
          style={inputStyle}
          value={form.zipCode}
          onChangeText={(v) => set("zipCode", v)}
          placeholder="78701"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="next"
        />
      </View>

      {/* Year Built + Sq Ft */}
      <View style={fStyles.row}>
        <View style={[fStyles.field, { flex: 1 }]}>
          <Text style={labelStyle}>{t("propertyForm.yearBuilt")}</Text>
          <TextInput
            style={inputStyle}
            value={form.yearBuilt}
            onChangeText={(v) => set("yearBuilt", v)}
            placeholder="1990"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="next"
          />
        </View>
        <View style={[fStyles.field, { flex: 1 }]}>
          <Text style={labelStyle}>{t("propertyForm.sqft")}</Text>
          <TextInput
            style={inputStyle}
            value={form.sqft}
            onChangeText={(v) => set("sqft", v)}
            placeholder="2000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
      </View>
    </>
  );
}
