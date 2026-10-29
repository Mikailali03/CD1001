import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";

const LABELS: Record<AppLanguage, string> = { en: "English", es: "Español" };

/** Two-option segmented control; each option is labelled in its own language. */
export function LanguageToggle() {
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const active = i18n.language;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("language.label")}
      style={[styles.wrap, { backgroundColor: colors.muted }]}
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const selected = active === lng;
        return (
          <TouchableOpacity
            key={lng}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLanguage={lng}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              setAppLanguage(lng);
            }}
            style={[styles.option, selected && { backgroundColor: colors.card }]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.text,
                {
                  color: selected ? colors.foreground : colors.mutedForeground,
                  fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              {LABELS[lng]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  option: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  text: { fontSize: 13 },
});
