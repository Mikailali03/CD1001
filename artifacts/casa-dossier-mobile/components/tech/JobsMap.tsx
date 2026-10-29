import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import Constants from "expo-constants";
import type { TechJobSummary } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { urgencyOf } from "./ui";

export const ATLANTA_REGION: Region = {
  latitude: 33.749,
  longitude: -84.388,
  latitudeDelta: 0.9,
  longitudeDelta: 0.9,
};

/**
 * Android's Google Maps SDK crashes on mount without an API key, so the map is
 * only offered there once `android.config.googleMaps.apiKey` is set in app.json.
 * iOS uses Apple Maps (no key needed).
 */
export function isMapAvailable(): boolean {
  if (Platform.OS === "ios") return true;
  if (Platform.OS !== "android") return false;
  const key = (Constants.expoConfig?.android as { config?: { googleMaps?: { apiKey?: string } } } | undefined)?.config
    ?.googleMaps?.apiKey;
  return !!key && !/^REPLACE|^YOUR_|PLACEHOLDER/i.test(key);
}

type Props = {
  jobs: TechJobSummary[];
  selectedId: string | null;
  onSelect: (jobId: string | null) => void;
};

/**
 * Open jobs on a map. Markers sit at the city-level coordinates the API returns
 * (never the property's own location — the address is revealed only after
 * accepting). User location is not shown: expo-location isn't a dependency.
 */
export function JobsMap({ jobs, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const categoryOf = (job: TechJobSummary) =>
    job.assetCategory
      ? t(`categories.${job.assetCategory}`, { defaultValue: job.assetCategory })
      : t("tech.map.serviceRequest");
  const mapRef = useRef<MapView | null>(null);

  // Pan to a job picked from the list.
  useEffect(() => {
    if (!selectedId) return;
    const job = jobs.find((j) => j.id === selectedId);
    if (job?.latitude == null || job.longitude == null) return;
    mapRef.current?.animateToRegion(
      { latitude: job.latitude, longitude: job.longitude, latitudeDelta: 0.25, longitudeDelta: 0.25 },
      350,
    );
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Several jobs in one city share coordinates; fan them out slightly so each is tappable.
  const seen = new Map<string, number>();
  const placed = jobs
    .filter((j) => j.latitude != null && j.longitude != null)
    .map((j) => {
      const key = `${j.latitude!.toFixed(3)},${j.longitude!.toFixed(3)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 0.004 * Math.sqrt(n);
      return { job: j, latitude: j.latitude! + r * Math.sin(angle), longitude: j.longitude! + r * Math.cos(angle) };
    });

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={ATLANTA_REGION}
        onPress={(e) => {
          // Tapping empty map clears the selection; marker taps are handled below.
          if (e.nativeEvent.action !== "marker-press") onSelect(null);
        }}
        toolbarEnabled={false}
        accessibilityLabel={t("tech.map.a11y", { count: placed.length })}
      >
        {placed.map(({ job, latitude, longitude }) => (
          <Marker
            key={job.id}
            identifier={job.id}
            coordinate={{ latitude, longitude }}
            pinColor={urgencyOf(job.urgency).color}
            title={categoryOf(job)}
            description={job.city ?? undefined}
            onPress={() => onSelect(job.id)}
            accessibilityLabel={t("tech.map.markerA11y", {
              urgency: urgencyOf(job.urgency).label,
              category: categoryOf(job),
              city: job.city ?? t("tech.map.unknownCity"),
            })}
          />
        ))}
      </MapView>
      <View
        pointerEvents="none"
        style={[styles.caption, { backgroundColor: colors.card + "E6", borderColor: colors.border }]}
      >
        <Text style={[styles.captionText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {t("tech.map.caption")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { position: "absolute", top: 12, right: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  captionText: { fontSize: 11 },
});
