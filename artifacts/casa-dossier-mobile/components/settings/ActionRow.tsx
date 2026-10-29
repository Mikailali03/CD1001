import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  colors,
  last,
  rightEl,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
  rightEl?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      activeOpacity={onPress && !disabled ? 0.6 : 1}
      disabled={disabled}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.destructive + "15" : colors.muted }]}>
        <Feather name={icon} size={17} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: danger ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.actionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {sublabel}
          </Text>
        )}
      </View>
      {rightEl ?? (onPress && <Feather name="chevron-right" size={15} color={colors.mutedForeground} />)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 15 },
  actionSub: { fontSize: 12, marginTop: 1 },
});
