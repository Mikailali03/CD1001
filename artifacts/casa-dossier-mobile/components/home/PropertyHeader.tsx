import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Property } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── Property header: name, location, specs ────────────────────────────────────
export function PropertyHeader({
  property, colors, onViewAll,
}: {
  property: Property; colors: ReturnType<typeof useColors>; onViewAll: () => void;
}) {
  const { t } = useTranslation();
  const location = [property.city, property.state].filter(Boolean).join(", ");
  const { bedrooms, bathrooms, sqft } = property;
  return (
    <View style={{ marginBottom: 14, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[propStyles.name, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1 }]} numberOfLines={1}>
          {property.name || property.address || t("common.myHome")}
        </Text>
        <TouchableOpacity
          onPress={onViewAll}
          style={[propStyles.viewAllBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          activeOpacity={0.7}
        >
          <Text style={[propStyles.viewAllText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            {t("home.allProperties")}
          </Text>
          <Feather name="chevron-right" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {location ? (
        <View style={propStyles.row}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[propStyles.location, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {location}
          </Text>
        </View>
      ) : null}
      {(bedrooms || bathrooms || sqft) ? (
        <View style={propStyles.row}>
          {bedrooms ? (
            <View style={propStyles.specItem}>
              <Feather name="layout" size={12} color={colors.mutedForeground} />
              <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("home.beds", { n: bedrooms })}
              </Text>
            </View>
          ) : null}
          {bathrooms ? (
            <View style={propStyles.specItem}>
              <Feather name="droplet" size={12} color={colors.mutedForeground} />
              <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("home.baths", { n: Number(bathrooms) })}
              </Text>
            </View>
          ) : null}
          {sqft ? (
            <View style={propStyles.specItem}>
              <Feather name="maximize" size={12} color={colors.mutedForeground} />
              <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("home.sqft", { n: Number(sqft).toLocaleString() })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const propStyles = StyleSheet.create({
  name: { fontSize: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 13 },
  specItem: { flexDirection: "row", alignItems: "center", gap: 3, marginRight: 10 },
  spec: { fontSize: 12 },
  viewAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  viewAllText: { fontSize: 12 },
});
