import React, { useState } from "react";
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
import { useTranslation } from "react-i18next";
import { useListProperties, type Property } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { PropertyFormModal } from "@/components/PropertyFormModal";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyHealthModal } from "@/components/properties/PropertyHealthModal";

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PropertiesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [], isLoading } = useListProperties();
  const [healthModalId, setHealthModalId] = useState<string | null>(null);

  // Form modal state
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formVisible, setFormVisible] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  function openAdd() {
    setFormMode("add");
    setEditingProperty(null);
    setFormVisible(true);
  }

  function openEdit(property: Property) {
    setFormMode("edit");
    setEditingProperty(property);
    setFormVisible(true);
  }

  const selectedProperty = healthModalId ? properties.find((p) => p.id === healthModalId) : null;
  const selectedName = selectedProperty
    ? (selectedProperty.name || selectedProperty.address || t("common.myHome"))
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="home" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("properties.title")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {properties.length}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("properties.addPropertyA11y")}
            hitSlop={8}
            onPress={openAdd}
            style={[styles.addHeaderBtn, { backgroundColor: colors.primary + "18" }]}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : properties.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="home" size={36} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("properties.emptyTitle")}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("properties.emptyDesc")}
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.emptyAddText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.addProperty")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onOpenHealth={() => setHealthModalId(property.id)}
              onEdit={() => openEdit(property)}
              colors={colors}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB — Add Property */}
      {properties.length > 0 && (
        <TouchableOpacity
          onPress={openAdd}
          style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 24 }]}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
          <Text style={[styles.fabText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>{t("common.addProperty")}</Text>
        </TouchableOpacity>
      )}

      {/* Health modal */}
      {healthModalId && selectedProperty && (
        <PropertyHealthModal
          propertyId={healthModalId}
          propertyName={selectedName}
          visible={!!healthModalId}
          onClose={() => setHealthModalId(null)}
          colors={colors}
          insets={insets}
        />
      )}

      {/* Add / Edit form modal */}
      <PropertyFormModal
        mode={formMode}
        property={editingProperty}
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        colors={colors}
        insets={insets}
      />
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
  addHeaderBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyAddText: { fontSize: 15 },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 15 },
});
