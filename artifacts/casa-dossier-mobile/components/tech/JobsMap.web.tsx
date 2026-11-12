import React from "react";
import type { ServiceArea, TechJobSummary } from "@workspace/api-client-react";

// react-native-maps has no web implementation; the Open Jobs tab falls back to
// the list on web (isMapAvailable() is false), so this never renders.

export function isMapAvailable(): boolean {
  return false;
}

export function JobsMap(_props: {
  jobs: TechJobSummary[];
  selectedId: string | null;
  onSelect: (jobId: string | null) => void;
  area: Pick<ServiceArea, "centerLat" | "centerLng" | "radiusMiles">;
}) {
  return null;
}
