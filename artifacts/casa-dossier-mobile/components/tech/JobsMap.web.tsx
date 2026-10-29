import React from "react";
import type { Region } from "react-native-maps";
import type { TechJobSummary } from "@workspace/api-client-react";

// react-native-maps has no web implementation; the Open Jobs tab falls back to
// the list on web (isMapAvailable() is false), so this never renders.
export const ATLANTA_REGION: Region = {
  latitude: 33.749,
  longitude: -84.388,
  latitudeDelta: 0.9,
  longitudeDelta: 0.9,
};

export function isMapAvailable(): boolean {
  return false;
}

export function JobsMap(_props: {
  jobs: TechJobSummary[];
  selectedId: string | null;
  onSelect: (jobId: string | null) => void;
}) {
  return null;
}
