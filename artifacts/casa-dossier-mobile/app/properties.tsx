import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useListProperties } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function PropertiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [], isLoading } = useListProperties();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="home" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            My Properties
          </Text>
        </View>
        <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {properties.length}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : properties.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="home" size={36} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            No properties yet
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Add your home in the web app to start tracking assets and maintenance.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {properties.map((property) => {
            const sp = property as any;
            const name = sp.name ?? sp.address ?? "My Home";
            const addressLine = [sp.address, sp.city, sp.state].filter(Boolean).join(", ");
            const specs: string[] = [];
            if (sp.yearBuilt) specs.push(`Built ${sp.yearBuilt}`);
            if (sp.sqft) specs.push(`${Number(sp.sqft).toLocaleString()} sqft`);
            if (sp.bedrooms) specs.push(`${sp.bedrooms} bd`);
            if (sp.bathrooms) specs.push(`${sp.bathrooms} ba`);

            return (
              <View
                key={property.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {/* Card header */}
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name="home" size={20} color={colors.primary} />
                  </View>
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
                </View>

                {/* Specs row */}
                {specs.length > 0 && (
                  <View style={[styles.specsRow, { borderTopColor: colors.border }]}>
                    {specs.map((spec, i) => (
                      <React.Fragment key={spec}>
                        {i > 0 && (
                          <View style={[styles.specDot, { backgroundColor: colors.mutedForeground }]} />
                        )}
                        <Text style={[styles.specText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {spec}
                        </Text>
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {/* Hint */}
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            To add or edit properties, visit the web app.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  countChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  countText: { fontSize: 13 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  card: {
    borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  cardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 16 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addrText: { fontSize: 12, flex: 1 },
  specsRow: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  specDot: { width: 3, height: 3, borderRadius: 99, opacity: 0.4 },
  specText: { fontSize: 12 },
  hint: { textAlign: "center", fontSize: 12, marginTop: 4 },
});
