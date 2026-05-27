import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hvac: "wind",
  plumbing: "droplet",
  electrical: "zap",
  roofing: "home",
  appliances: "cpu",
  landscaping: "sun",
  safety: "shield",
  structural: "layers",
  default: "box",
};

interface AssetCardProps {
  name: string;
  category: string;
  condition?: string;
  lastServiceDate?: string | null;
  onPress?: () => void;
}

function conditionColor(condition: string | undefined, colors: ReturnType<typeof useColors>) {
  switch (condition?.toLowerCase()) {
    case "excellent": return colors.success;
    case "good": return colors.success;
    case "fair": return colors.warning;
    case "poor": return colors.destructive;
    case "critical": return colors.destructive;
    default: return colors.mutedForeground;
  }
}

export function AssetCard({ name, category, condition, lastServiceDate, onPress }: AssetCardProps) {
  const colors = useColors();
  const icon = CATEGORY_ICONS[category?.toLowerCase()] ?? CATEGORY_ICONS.default;
  const dotColor = conditionColor(condition, colors);

  const lastService = lastServiceDate
    ? new Date(lastServiceDate).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "No record";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={20} color={colors.foreground} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.category, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {category} · Last: {lastService}
        </Text>
      </View>
      {condition && (
        <View style={[styles.badge, { backgroundColor: dotColor + "20" }]}>
          <Text style={[styles.badgeText, { color: dotColor, fontFamily: "Inter_500Medium" }]}>
            {condition}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
  },
  category: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
});
