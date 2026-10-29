import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import {
  getListAssignedJobsQueryKey,
  useListAssignedJobs,
  type AssignedJobSummary,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage, apiErrorStatus } from "@/hooks/useRole";
import { EmptyState } from "@/components/EmptyState";
import { TECH_HOME, techJobHref } from "@/components/tech/routes";
import {
  Chip,
  ListSkeleton,
  TabHeader,
  fmtDate,
  isSameLocalDay,
  joinParts,
  statusOf,
  ui,
  urgencyOf,
  useRefetchRoleOn403,
  useTabBottomPad,
} from "@/components/tech/ui";

export default function MyJobsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const bottomPad = useTabBottomPad();
  const [refreshing, setRefreshing] = useState(false);
  // Same deep link as the web portal: /my-jobs?job=<id> opens that job.
  const { job: deepLinkJobId } = useLocalSearchParams<{ job?: string }>();
  const handledDeepLink = useRef<string | null>(null);

  const query = useListAssignedJobs({
    query: {
      queryKey: getListAssignedJobsQueryKey(),
      retry: (n, err) => apiErrorStatus(err) !== 403 && n < 2,
    },
  });
  useRefetchRoleOn403(query.error);

  // (The first focus is the initial mount, which already fetches.)
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) query.refetch();
      focusedOnce.current = true;
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!deepLinkJobId || handledDeepLink.current === deepLinkJobId) return;
    handledDeepLink.current = deepLinkJobId;
    router.push(techJobHref(deepLinkJobId));
  }, [deepLinkJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onRefresh() {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await query.refetch();
    setRefreshing(false);
  }

  const jobs = query.data ?? [];
  const needsSchedule = jobs.filter((j) => !j.scheduledAt).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader
        icon="briefcase"
        title={t("tech.myJobs.title")}
        subtitle={
          query.isPending
            ? t("tech.myJobs.loading")
            : jobs.length === 0
              ? t("tech.myJobs.emptySubtitle")
              : needsSchedule
                ? t("tech.myJobs.activeNeedDate", { count: jobs.length, needDate: needsSchedule })
                : t("tech.myJobs.active", { count: jobs.length })
        }
      />
      {query.isPending ? (
        <ListSkeleton count={3} height={120} />
      ) : query.isError && !query.data ? (
        apiErrorStatus(query.error) === 403 ? (
          <EmptyState
            icon="lock"
            title={t("tech.accessRequired.title")}
            description={t("tech.accessRequired.noAccess")}
          />
        ) : (
          <EmptyState
            icon="wifi-off"
            title={t("tech.myJobs.loadError")}
            description={apiErrorMessage(query.error) ?? t("common.checkConnection")}
            actionLabel={t("common.retry")}
            onAction={() => query.refetch()}
          />
        )
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPad, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            jobs.length > 0 ? (
              <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 2 }]}>
                {t("tech.myJobs.hint")}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="briefcase"
              title={t("tech.myJobs.emptyTitle")}
              description={t("tech.myJobs.emptyDesc")}
              actionLabel={t("tech.myJobs.browseOpen")}
              onAction={() => {
                Haptics.selectionAsync();
                router.navigate(TECH_HOME);
              }}
            />
          }
          renderItem={({ item }) => (
            <AssignedJobCard
              job={item}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(techJobHref(item.id));
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function AssignedJobCard({ job, onPress }: { job: AssignedJobSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const uc = urgencyOf(job.urgency);
  const status = job.status as string;
  const sc = statusOf(status);
  const today = isSameLocalDay(job.scheduledAt);
  const address = joinParts(job.propertyAddress, job.propertyCity, job.propertyState);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("tech.myJobs.cardA11y", {
        asset: job.assetBrand ? t("tech.assetWithBrand", { name: job.assetName, brand: job.assetBrand }) : job.assetName,
        status: sc.label,
        schedule: job.scheduledAt
          ? t("tech.myJobs.scheduledFor", { date: fmtDate(job.scheduledAt, t("tech.dateFormats.monthDayTime")) })
          : t("tech.myJobs.scheduleNeeded"),
        address,
      })}
      accessibilityHint={t("tech.opensJobDetails")}
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: uc.color }]}
    >
      <View style={styles.row}>
        <Feather name={uc.icon} size={14} color={uc.color} />
        <Text numberOfLines={1} style={[styles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {job.assetName}
          {job.assetBrand ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}> — {job.assetBrand}</Text>
          ) : null}
        </Text>
        {job.scheduledAt ? (
          <Chip label={today ? t("tech.today") : fmtDate(job.scheduledAt, "MMM d")!} color="#059669" icon="calendar" />
        ) : (
          <Chip label={t("tech.myJobs.scheduleNeeded")} color="#d97706" />
        )}
      </View>
      {status !== "claimed" && <Chip label={sc.label} color={sc.color} icon={sc.icon} />}
      <Text numberOfLines={2} style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {job.description}
      </Text>
      <View style={styles.metaRow}>
        {address ? (
          <View style={styles.meta}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", flexShrink: 1 }]}>
              {address}
            </Text>
          </View>
        ) : null}
        {job.contactPhone ? (
          <View style={styles.meta}>
            <Feather name="phone" size={12} color={colors.mutedForeground} />
            <Text style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{job.contactPhone}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 14 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
});
