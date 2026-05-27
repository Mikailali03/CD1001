import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useListProperties,
  useGetPropertySummary,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { HealthScoreRing } from "@/components/HealthScoreRing";
import { EmptyState } from "@/components/EmptyState";
import * as Haptics from "expo-haptics";

type TaskItem = {
  id: string;
  name?: string;
  taskName?: string;
  dueDate?: string | null;
  nextDueDate?: string | null;
  assetName?: string;
  status?: string;
};

function TaskCard({ task, colors }: { task: TaskItem; colors: ReturnType<typeof useColors> }) {
  const name = task.name ?? task.taskName ?? "Maintenance Task";
  const due = task.dueDate ?? task.nextDueDate;
  const dueLabel = due
    ? new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No date set";

  const isOverdue = due ? new Date(due) < new Date() : false;

  return (
    <View style={[taskStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[taskStyles.dot, { backgroundColor: isOverdue ? colors.destructive : colors.warning }]} />
      <View style={taskStyles.content}>
        <Text style={[taskStyles.name, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[taskStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {task.assetName ? `${task.assetName} · ` : ""}Due {dueLabel}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </View>
  );
}

const taskStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { flex: 1 },
  name: { fontSize: 14 },
  meta: { fontSize: 12, marginTop: 2 },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { data: properties = [], isLoading: propsLoading, refetch: refetchProps } =
    useListProperties();

  const selectedProperty = properties[selectedIdx];

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } =
    useGetPropertySummary(
      selectedProperty?.id ?? "",
      { query: { enabled: !!selectedProperty?.id } }
    );

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchProps(), refetchSummary()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoading = propsLoading;

  const healthScore: number = (summary as { healthScore?: number } | undefined)?.healthScore ?? 0;
  const totalAssets: number = (summary as { totalAssets?: number } | undefined)?.totalAssets ?? 0;
  const upcomingTasks: TaskItem[] = (summary as { upcomingTasks?: TaskItem[] } | undefined)?.upcomingTasks ?? [];
  const overdueCount: number = upcomingTasks.filter((t) => {
    const d = t.dueDate ?? t.nextDueDate;
    return d && new Date(d) < new Date();
  }).length;

  const address = selectedProperty
    ? [selectedProperty.address, selectedProperty.city, selectedProperty.state]
        .filter(Boolean)
        .join(", ")
    : "";

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Casa Dossier</Text>
        </View>
        <EmptyState
          icon="home"
          title="No Properties Yet"
          description="Add your first property in the web app to get started."
        />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={{ paddingTop: topPad }}>
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: 20 }]}>
            <Text style={[styles.logo, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Casa Dossier
            </Text>
          </View>

          {/* Property selector chips */}
          {properties.length > 1 && (
            <FlatList
              horizontal
              data={properties}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: index === selectedIdx ? colors.primary : colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedIdx(index);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: index === selectedIdx ? colors.primaryForeground : colors.foreground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.address ?? "Property"}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Property health card */}
          <View style={{ paddingHorizontal: 20 }}>
            <View
              style={[
                styles.healthCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.healthTop}>
                <View style={styles.healthLeft}>
                  <Text
                    style={[styles.address, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                    numberOfLines={2}
                  >
                    {address || "My Home"}
                  </Text>
                  <Text
                    style={[styles.healthLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                  >
                    Property Health Score
                  </Text>
                </View>
                {summaryLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <HealthScoreRing score={healthScore} size={90} />
                )}
              </View>

              {/* Stats row */}
              <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {totalAssets}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Assets
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text
                    style={[
                      styles.statNum,
                      {
                        color: upcomingTasks.length > 0 ? colors.warning : colors.success,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {upcomingTasks.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Upcoming
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text
                    style={[
                      styles.statNum,
                      {
                        color: overdueCount > 0 ? colors.destructive : colors.success,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {overdueCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Overdue
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tasks header */}
          {upcomingTasks.length > 0 && (
            <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Upcoming Tasks
              </Text>
            </View>
          )}
        </View>
      }
      data={upcomingTasks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 20 }}>
          <TaskCard task={item} colors={colors} />
        </View>
      )}
      ListEmptyComponent={
        summaryLoading ? null : (
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <View
              style={[styles.emptyTasksCard, { backgroundColor: colors.accent, borderColor: colors.border }]}
            >
              <Feather name="check-circle" size={20} color={colors.accentForeground} />
              <Text
                style={[styles.emptyTasksText, { color: colors.accentForeground, fontFamily: "Inter_500Medium" }]}
              >
                All caught up — no upcoming tasks
              </Text>
            </View>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingTop: 8,
  },
  logo: { fontSize: 22 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 180,
  },
  chipText: { fontSize: 13 },
  healthCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  healthTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    gap: 12,
  },
  healthLeft: { flex: 1, gap: 4 },
  address: { fontSize: 16, lineHeight: 22 },
  healthLabel: { fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 22 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: "80%" },
  sectionHeader: { paddingTop: 4, paddingBottom: 12 },
  sectionTitle: { fontSize: 16 },
  emptyTasksCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyTasksText: { fontSize: 14 },
});
