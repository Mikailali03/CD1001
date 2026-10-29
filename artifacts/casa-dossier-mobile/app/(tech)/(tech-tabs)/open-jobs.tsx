import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import {
  getListOpenMarketplaceJobsQueryKey,
  useListOpenMarketplaceJobs,
  type TechJobSummary,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { apiErrorMessage, apiErrorStatus } from "@/hooks/useRole";
import { EmptyState } from "@/components/EmptyState";
import { JobsMap, isMapAvailable } from "@/components/tech/JobsMap";
import { techJobHref } from "@/components/tech/routes";
import {
  Chip,
  ListSkeleton,
  Notice,
  TabHeader,
  fmtDate,
  joinParts,
  ui,
  urgencyOf,
  useRefetchRoleOn403,
  useTabBottomPad,
} from "@/components/tech/ui";

// Service area — same as the web portal (Atlanta, 50-mile radius).
const ATLANTA_LAT = 33.749;
const ATLANTA_LNG = -84.388;
const SERVICE_RADIUS_MILES = 50;

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inServiceArea(j: TechJobSummary) {
  return (
    j.latitude != null &&
    j.longitude != null &&
    distanceMiles(ATLANTA_LAT, ATLANTA_LNG, j.latitude, j.longitude) <= SERVICE_RADIUS_MILES
  );
}

type ViewMode = "map" | "list";

export default function OpenJobsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const bottomPad = useTabBottomPad();
  const mapAvailable = isMapAvailable();
  const [mode, setMode] = useState<ViewMode>(mapAvailable ? "map" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useListOpenMarketplaceJobs({
    query: {
      queryKey: getListOpenMarketplaceJobsQueryKey(),
      retry: (n, err) => apiErrorStatus(err) !== 403 && n < 2,
    },
  });
  useRefetchRoleOn403(query.error);

  // Refresh whenever the tab comes back into view (e.g. after accepting a job).
  // (The first focus is the initial mount, which already fetches.)
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) query.refetch();
      focusedOnce.current = true;
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { mapJobs, listJobs } = useMemo(() => {
    const all = query.data ?? [];
    const mapped = all.filter(inServiceArea);
    // Jobs whose city couldn't be geocoded have no pin; keep them in the list
    // so they aren't invisible (the web portal drops them).
    const unlocated = all.filter((j) => j.latitude == null || j.longitude == null);
    return { mapJobs: mapped, listJobs: [...mapped, ...unlocated] };
  }, [query.data]);

  const selected = mapJobs.find((j) => j.id === selectedId) ?? null;

  function openJob(id: string) {
    Haptics.selectionAsync();
    router.push(techJobHref(id));
  }

  async function onRefresh() {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await query.refetch();
    setRefreshing(false);
  }

  const toggle = mapAvailable ? (
    <View style={[styles.toggle, { backgroundColor: colors.muted }]} accessibilityRole="tablist">
      {(["map", "list"] as const).map((m) => {
        const active = mode === m;
        return (
          <TouchableOpacity
            key={m}
            accessibilityRole="tab"
            accessibilityLabel={m === "map" ? t("tech.openJobs.mapView") : t("tech.openJobs.listView")}
            accessibilityState={{ selected: active }}
            onPress={() => {
              Haptics.selectionAsync();
              setMode(m);
            }}
            style={[styles.toggleBtn, active && { backgroundColor: colors.card }]}
            activeOpacity={0.7}
          >
            <Feather name={m === "map" ? "map" : "list"} size={16} color={active ? colors.foreground : colors.mutedForeground} />
          </TouchableOpacity>
        );
      })}
    </View>
  ) : null;

  const subtitle = query.isPending
    ? t("tech.openJobs.loading")
    : t("tech.openJobs.subtitle", { count: listJobs.length });

  let body: React.ReactNode;
  if (query.isPending) {
    body = <ListSkeleton count={5} height={92} />;
  } else if (query.isError && !query.data) {
    body =
      apiErrorStatus(query.error) === 403 ? (
        <EmptyState
          icon="lock"
          title={t("tech.accessRequired.title")}
          description={t("tech.accessRequired.noAccess")}
        />
      ) : (
        <EmptyState
          icon="wifi-off"
          title={t("tech.openJobs.loadError")}
          description={apiErrorMessage(query.error) ?? t("common.checkConnection")}
          actionLabel={t("common.retry")}
          onAction={() => query.refetch()}
        />
      );
  } else if (mode === "map" && mapAvailable) {
    body = (
      <View style={{ flex: 1 }}>
        <JobsMap jobs={mapJobs} selectedId={selectedId} onSelect={setSelectedId} />
        {listJobs.length === 0 && (
          <View pointerEvents="none" style={[styles.mapEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-circle" size={16} color={colors.mutedForeground} />
            <Text style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("tech.openJobs.noneInArea")}
            </Text>
          </View>
        )}
        {selected && (
          <View style={[styles.mapCardWrap, { bottom: bottomPad - 16 }]}>
            <JobCard job={selected} onPress={() => openJob(selected.id)} elevated />
          </View>
        )}
      </View>
    );
  } else {
    body = (
      <FlatList
        data={listJobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          !mapAvailable && __DEV__ ? (
            <View style={{ marginBottom: 4 }}>
              <Notice
                tone="info"
                message="Map view is off: add android.config.googleMaps.apiKey to app.json to enable it on Android."
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="check-circle"
            title={t("tech.openJobs.emptyTitle")}
            description={t("tech.openJobs.emptyDesc")}
          />
        }
        renderItem={({ item }) => <JobCard job={item} onPress={() => openJob(item.id)} />}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader icon="map" title={t("tech.openJobs.title")} subtitle={subtitle} right={toggle} />
      {body}
    </View>
  );
}

function JobCard({ job, onPress, elevated }: { job: TechJobSummary; onPress: () => void; elevated?: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const uc = urgencyOf(job.urgency);
  const place = joinParts(job.city, job.state) || t("tech.locationPending");
  const category = job.assetCategory
    ? t(`categories.${job.assetCategory}`, { defaultValue: job.assetCategory })
    : t("tech.generalService");
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("tech.openJobs.cardA11y", { urgency: uc.label, category, place, description: job.description })}
      accessibilityHint={t("tech.opensJobDetails")}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: uc.color },
        elevated && styles.elevated,
      ]}
    >
      <View style={styles.cardTop}>
        <Feather name={uc.icon} size={14} color={uc.color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {category}
          </Text>
          <Text numberOfLines={1} style={[ui.small, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("tech.openJobs.placePosted", { place, date: fmtDate(job.createdAt, "MMM d") })}
          </Text>
        </View>
        <Chip label={uc.label} color={uc.color} />
      </View>
      <Text numberOfLines={2} style={[ui.muted, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginLeft: 22 }]}>
        {job.description}
      </Text>
      {elevated && (
        <View style={[styles.cardCta, { marginLeft: 22 }]}>
          <Text style={[ui.label, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{t("tech.viewDetails")}</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  toggleBtn: { width: 38, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 12, gap: 6 },
  elevated: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 14 },
  cardCta: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  mapCardWrap: { position: "absolute", left: 16, right: 16 },
  mapEmpty: { position: "absolute", top: 52, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
