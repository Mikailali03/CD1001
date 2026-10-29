import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { InviteBanner } from "@/components/home/InviteBanner";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── First run: no property yet ────────────────────────────────────────────────
export function NoPropertyView({
  pendingCount, onOpenInvites, onAddProperty, colors,
}: {
  pendingCount: number; onOpenInvites: () => void; onAddProperty: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
      {pendingCount > 0 && (
        <InviteBanner
          count={pendingCount}
          onPress={onOpenInvites}
          colors={colors}
          style={{ marginBottom: 24, width: "100%" }}
        />
      )}
      <View style={[{ backgroundColor: colors.muted, borderRadius: 20, padding: 24, marginBottom: 20 }]}>
        <Feather name="home" size={48} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
      </View>
      <Text style={{ fontSize: 20, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>
        {t("common.noPropertyYet")}
      </Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular", marginBottom: 28 }}>
        {t("home.noPropertyDesc")}
      </Text>
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); onAddProperty(); }}
        activeOpacity={0.85}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: colors.primary, borderRadius: 14,
          paddingHorizontal: 24, paddingVertical: 14,
        }}
      >
        <Feather name="plus" size={18} color={colors.primaryForeground} />
        <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground }}>
          {t("common.addProperty")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
