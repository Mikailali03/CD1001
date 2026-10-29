import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Property } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { resolveStorageUrl } from "@/lib/config";
import { PropertyScoreRing } from "./PropertyScoreRing";

// ── One property: photo, name, address, health ring, specs, edit ──────────────
export function PropertyCard({
  property, onOpenHealth, onEdit, colors,
}: {
  property: Property; onOpenHealth: () => void; onEdit: () => void; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const name = property.name || property.address || t("common.myHome");
  const addressLine = [property.address, property.city, property.state].filter(Boolean).join(", ");
  const specs: string[] = [];
  if (property.yearBuilt) specs.push(t("properties.built", { year: property.yearBuilt }));
  if (property.sqft) specs.push(t("properties.sqft", { value: Number(property.sqft).toLocaleString() }));
  if (property.bedrooms) specs.push(t("properties.beds", { count: property.bedrooms }));
  // bathrooms is a decimal column and can arrive as "2.50"
  if (property.bathrooms) specs.push(t("properties.baths", { count: Number(property.bathrooms) }));
  const photoUrl = resolveStorageUrl(property.photoUrl);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card top */}
      <View style={styles.cardTop}>
        {/* Photo or icon */}
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.cardPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="home" size={20} color={colors.primary} />
          </View>
        )}

        {/* Name + address */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.cardName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
            {name}
          </Text>
          {addressLine ? (
            <View style={styles.addrRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.addrText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                {addressLine}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Health score ring */}
        <PropertyScoreRing
          propertyId={property.id}
          onPress={onOpenHealth}
          colors={colors}
        />
      </View>

      {/* Specs row + Edit button */}
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.specsRow}>
          {specs.map((spec, i) => (
            <React.Fragment key={spec}>
              {i > 0 && <View style={[styles.specDot, { backgroundColor: colors.mutedForeground }]} />}
              <Text style={[styles.specText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {spec}
              </Text>
            </React.Fragment>
          ))}
        </View>
        <TouchableOpacity
          onPress={onEdit}
          style={[styles.editBtn, { backgroundColor: colors.muted }]}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={12} color={colors.mutedForeground} />
          <Text style={[styles.editText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("common.edit")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  cardPhoto: { width: 52, height: 52, borderRadius: 12 },
  cardIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 16 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addrText: { fontSize: 12, flex: 1 },
  cardFooter: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  specsRow: {
    flex: 1,
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6,
  },
  specDot: { width: 3, height: 3, borderRadius: 99, opacity: 0.4 },
  specText: { fontSize: 12 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editText: { fontSize: 12 },
});
