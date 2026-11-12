// CasaService's service area: a center point and a radius. One config value,
// SERVICE_AREA="<lat>,<lng>,<radiusMiles>[,<name>]", defaulting to metro
// Atlanta. The API enforces it when a homeowner requests service, and the
// technician map and the apps read it from GET /service-area.

export interface ServiceArea {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
}

export const DEFAULT_SERVICE_AREA: ServiceArea = {
  name: "Atlanta area",
  centerLat: 33.749,
  centerLng: -84.388,
  radiusMiles: 50,
};

export function parseServiceArea(raw: string | undefined | null): ServiceArea {
  if (!raw?.trim()) return DEFAULT_SERVICE_AREA;
  const [lat, lng, radius, ...nameParts] = raw.split(",").map((s) => s.trim());
  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const radiusMiles = Number(radius);
  if (
    !Number.isFinite(centerLat) || Math.abs(centerLat) > 90 ||
    !Number.isFinite(centerLng) || Math.abs(centerLng) > 180 ||
    !Number.isFinite(radiusMiles) || radiusMiles <= 0
  ) {
    throw new Error(`Invalid SERVICE_AREA "${raw}". Expected "<lat>,<lng>,<radiusMiles>[,<name>]".`);
  }
  const name = nameParts.join(",").trim() || DEFAULT_SERVICE_AREA.name;
  return { name, centerLat, centerLng, radiusMiles };
}

let cached: ServiceArea | null = null;

export function getServiceArea(): ServiceArea {
  cached ??= parseServiceArea(process.env.SERVICE_AREA);
  return cached;
}

/** Great-circle distance in miles. */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type ServiceAreaCheck = "inside" | "outside" | "unknown";

/** Whether a point is inside the area. "unknown" when there's no location to check. */
export function checkServiceArea(
  coords: { lat: number; lng: number } | null,
  area: ServiceArea = getServiceArea(),
): ServiceAreaCheck {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return "unknown";
  return distanceMiles(area.centerLat, area.centerLng, coords.lat, coords.lng) <= area.radiusMiles
    ? "inside"
    : "outside";
}
