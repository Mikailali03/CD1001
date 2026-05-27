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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetGuide, getGetGuideQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "#3d7a5f", bg: "#3d7a5f18" },
  medium: { label: "Medium", color: "#c8853a", bg: "#c8853a18" },
  hard:   { label: "Hard",   color: "#c0392b", bg: "#c0392b18" },
} as const;

export default function GuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: guide, isLoading } = useGetGuide(id!, {
    query: { queryKey: getGetGuideQueryKey(id!) },
  });

  const diff = guide ? (DIFFICULTY_CONFIG[(guide.difficulty as keyof typeof DIFFICULTY_CONFIG)] ?? DIFFICULTY_CONFIG.medium) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {guide?.title ?? "Guide"}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !guide ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.mutedForeground }}>Guide not found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Meta */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            <View style={[s.badge, { backgroundColor: colors.muted }]}>
              <Text style={[s.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{guide.category}</Text>
            </View>
            {diff && (
              <View style={[s.badge, { backgroundColor: diff.bg }]}>
                <Text style={[s.badgeText, { color: diff.color, fontFamily: "Inter_600SemiBold" }]}>{diff.label}</Text>
              </View>
            )}
            <View style={[s.badge, { backgroundColor: colors.muted }]}>
              <Feather name="clock" size={11} color={colors.mutedForeground} />
              <Text style={[s.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {guide.estimatedMinutes}m
              </Text>
            </View>
          </View>

          <Text style={[s.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {guide.title}
          </Text>
          {guide.description ? (
            <Text style={[s.description, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {guide.description}
            </Text>
          ) : null}

          {/* Tools needed */}
          {(guide.toolsNeeded?.length ?? 0) > 0 && (
            <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.sectionHeader}>
                <Feather name="tool" size={15} color={colors.primary} />
                <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  Tools Needed
                </Text>
              </View>
              <View style={{ gap: 6, marginTop: 10 }}>
                {guide.toolsNeeded!.map((tool, i) => (
                  <View key={i} style={s.toolRow}>
                    <View style={[s.toolDot, { backgroundColor: colors.primary }]} />
                    <Text style={[s.toolText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{tool}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Steps */}
          {(guide.steps?.length ?? 0) > 0 && (
            <View style={{ marginTop: 20, gap: 10 }}>
              <Text style={[s.stepsLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Steps
              </Text>
              {guide.steps!.map((step, i) => (
                <View key={i} style={[s.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={[s.stepNumText, { fontFamily: "Inter_700Bold" }]}>{step.step}</Text>
                  </View>
                  <Text style={[s.stepDesc, { color: colors.foreground, fontFamily: "Inter_400Regular", flex: 1 }]}>
                    {step.instruction}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerLabel: { flex: 1, fontSize: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11 },
  title: { fontSize: 22, lineHeight: 28, marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolDot: { width: 5, height: 5, borderRadius: 99 },
  toolText: { fontSize: 13 },
  stepsLabel: { fontSize: 18 },
  stepCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 99, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { color: "#fff", fontSize: 12 },
  stepTitle: { fontSize: 14 },
  stepDesc: { fontSize: 13, lineHeight: 19 },
  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 8, borderWidth: 1, padding: 8, marginTop: 4 },
  tipText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
