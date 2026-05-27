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
import { useListGuides } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "#3d7a5f", bg: "#3d7a5f18" },
  medium: { label: "Medium", color: "#c8853a", bg: "#c8853a18" },
  hard:   { label: "Hard",   color: "#c0392b", bg: "#c0392b18" },
} as const;

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  HVAC:       "wind",
  Plumbing:   "droplet",
  Electrical: "zap",
  Roof:       "home",
  Appliance:  "cpu",
  Structural: "layers",
  Other:      "tool",
};

export default function DiyGuidesScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: guides = [], isLoading } = useListGuides();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(guides.map((g) => g.category))).sort();
  const filtered = selectedCategory
    ? guides.filter((g) => g.category === selectedCategory)
    : guides;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="book-open" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              DIY Guide Library
            </Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Step-by-step home maintenance
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Category filters */}
          {categories.length > 0 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
              style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexGrow: 0 }}
            >
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setSelectedCategory(null); }}
                style={[s.chip, { backgroundColor: !selectedCategory ? colors.primary : colors.card, borderColor: !selectedCategory ? colors.primary : colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, { color: !selectedCategory ? "#fff" : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat === selectedCategory ? null : cat); }}
                  style={[s.chip, { backgroundColor: selectedCategory === cat ? colors.primary : colors.card, borderColor: selectedCategory === cat ? colors.primary : colors.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, { color: selectedCategory === cat ? "#fff" : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
                <Feather name="book-open" size={40} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>No guides found</Text>
              </View>
            ) : (
              filtered.map((guide) => {
                const diff = DIFFICULTY_CONFIG[(guide.difficulty as keyof typeof DIFFICULTY_CONFIG)] ?? DIFFICULTY_CONFIG.medium;
                const catIcon = CATEGORY_ICONS[guide.category] ?? "tool";
                return (
                  <TouchableOpacity
                    key={guide.id}
                    onPress={() => { Haptics.selectionAsync(); router.push(`/guide/${guide.id}`); }}
                    style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.75}
                  >
                    {/* Top row */}
                    <View style={s.cardTop}>
                      <View style={[s.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                        <Feather name={catIcon} size={18} color={colors.primary} />
                      </View>
                      <View style={s.badges}>
                        <View style={[s.badge, { backgroundColor: colors.muted }]}>
                          <Text style={[s.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{guide.category}</Text>
                        </View>
                        <View style={[s.badge, { backgroundColor: diff.bg }]}>
                          <Text style={[s.badgeText, { color: diff.color, fontFamily: "Inter_600SemiBold" }]}>{diff.label}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Title + description */}
                    <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={2}>
                      {guide.title}
                    </Text>
                    {guide.description ? (
                      <Text style={[s.cardDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                        {guide.description}
                      </Text>
                    ) : null}

                    {/* Footer */}
                    <View style={[s.cardFooter, { borderTopColor: colors.border }]}>
                      <View style={s.footerLeft}>
                        <View style={s.footerItem}>
                          <Feather name="clock" size={12} color={colors.mutedForeground} />
                          <Text style={[s.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            {guide.estimatedMinutes}m
                          </Text>
                        </View>
                        {(guide.toolsNeeded?.length ?? 0) > 0 && (
                          <View style={s.footerItem}>
                            <Feather name="tool" size={12} color={colors.mutedForeground} />
                            <Text style={[s.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                              {guide.toolsNeeded!.length} tools
                            </Text>
                          </View>
                        )}
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 11, marginTop: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  chipText: { fontSize: 13 },
  emptyTitle: { fontSize: 16 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  cardTitle: { fontSize: 15, lineHeight: 21, paddingHorizontal: 14 },
  cardDesc: { fontSize: 12, lineHeight: 17, paddingHorizontal: 14, marginTop: 4 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 12 },
});
