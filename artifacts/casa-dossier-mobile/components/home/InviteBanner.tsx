import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── Pending invites banner ────────────────────────────────────────────────────
export function InviteBanner({
  count, onPress, colors, style,
}: {
  count: number; onPress: () => void; colors: ReturnType<typeof useColors>; style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[inviteBannerStyles.banner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }, style]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.8}
    >
      <View style={[inviteBannerStyles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
        <Feather name="mail" size={14} color={colors.primary} />
      </View>
      <View style={inviteBannerStyles.textWrap}>
        <Text style={[inviteBannerStyles.title, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
          {t("invites.bannerTitle", { count })}
        </Text>
        <Text style={[inviteBannerStyles.sub, { color: colors.primary + "bb", fontFamily: "Inter_400Regular" }]}>
          {t("invites.bannerSub")}
        </Text>
      </View>
      <View style={[inviteBannerStyles.badge, { backgroundColor: colors.primary }]}>
        <Text style={[inviteBannerStyles.badgeText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
          {count}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}

const inviteBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 13 },
  sub: { fontSize: 11, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11 },
});
