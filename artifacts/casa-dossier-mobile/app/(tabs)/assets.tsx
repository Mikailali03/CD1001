import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListProperties, useListAssets } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AssetCard } from "@/components/AssetCard";
import { EmptyState } from "@/components/EmptyState";
import * as Haptics from "expo-haptics";

const CATEGORIES = ["All", "HVAC", "Plumbing", "Electrical", "Roofing", "Appliances", "Safety", "Structural"];

type Asset = {
  id: string;
  name: string;
  category: string;
  condition?: string;
  lastServiceDate?: string | null;
};

export default function AssetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const { data: properties = [] } = useListProperties();
  const propertyId = properties[0]?.id ?? "";

  const { data: assets = [], isLoading, refetch } = useListAssets(
    propertyId,
    activeCategory !== "All" ? { category: activeCategory.toLowerCase() } : {},
    { query: { enabled: !!propertyId } }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          My Assets
        </Text>
        {properties.length > 0 && (
          <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {properties[0]?.address ?? "My Home"}
          </Text>
        )}

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: cat === activeCategory ? colors.primary : colors.muted,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                setActiveCategory(cat);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: cat === activeCategory ? colors.primaryForeground : colors.foreground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {!propertyId ? (
        <EmptyState
          icon="package"
          title="No Property Found"
          description="Set up your home in the web app to manage assets here."
        />
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={assets as Asset[]}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <AssetCard
              name={item.name}
              category={item.category}
              condition={item.condition}
              lastServiceDate={item.lastServiceDate}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="package"
              title={activeCategory === "All" ? "No Assets Yet" : `No ${activeCategory} Assets`}
              description={
                activeCategory === "All"
                  ? "Track your appliances, systems, and home features."
                  : `No ${activeCategory} assets found. Try another category.`
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, paddingTop: 8 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
