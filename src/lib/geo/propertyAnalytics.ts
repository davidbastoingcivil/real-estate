import type { LivePoi, LivePoiCounts, PoiCategory } from "@/lib/geo/overpassClient";
import type { PoiHeatCell } from "@/lib/geoaiEngine";

export type PropertyGeoAnalyticsRow = {
  property_id: number;
  accessibility: Record<string, unknown>;
  pois: Record<string, unknown>;
  urban_norm: Record<string, unknown>;
  search_radius_m: number;
  source_name: string | null;
  source_updated_at: string | null;
  status: "pending" | "ready" | "unavailable";
  updated_at: string;
};

const categories: PoiCategory[] = ["transport", "health", "education", "commercial", "parks"];

export function analyticsPoiCounts(value: unknown): LivePoiCounts {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(categories.map(category => [
    category,
    typeof input[category] === "number" && Number.isFinite(input[category]) ? Math.max(0, Math.floor(input[category] as number)) : 0,
  ])) as LivePoiCounts;
}

export function analyticsPoiPoints(value: unknown): LivePoi[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const point = item as Partial<LivePoi>;
    if (!point.id || !point.name || !categories.includes(point.category as PoiCategory)
      || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !Number.isFinite(point.distanceMeters)) return [];
    if ((point.lat as number) < -90 || (point.lat as number) > 90 || (point.lng as number) < -180 || (point.lng as number) > 180) return [];
    return [{
      id: point.id || `cached-${index}`,
      name: point.name,
      category: point.category as PoiCategory,
      lat: point.lat as number,
      lng: point.lng as number,
      distanceMeters: Math.max(0, Math.round(point.distanceMeters as number)),
    }];
  });
}

export function analyticsHeatmap(points: LivePoi[], radiusMeters: number): { type: "FeatureCollection"; features: PoiHeatCell[]; radius_meters: number; cell_size_meters: number; method: string } {
  const cellSize = 400;
  const groups = new Map<string, { lat: number; lng: number; count: number; categories: Record<string, number> }>();
  for (const point of points) {
    const latStep = cellSize / 111_320;
    const lngStep = cellSize / (111_320 * Math.max(Math.abs(Math.cos(point.lat * Math.PI / 180)), 0.1));
    const key = `${Math.floor(point.lat / latStep)}:${Math.floor(point.lng / lngStep)}`;
    const group = groups.get(key) || { lat: 0, lng: 0, count: 0, categories: {} };
    group.lat += point.lat;
    group.lng += point.lng;
    group.count += 1;
    group.categories[point.category] = (group.categories[point.category] || 0) + 1;
    groups.set(key, group);
  }
  return {
    type: "FeatureCollection",
    radius_meters: radiusMeters,
    cell_size_meters: cellSize,
    method: "supabase_property_geo_analytics_cache",
    features: [...groups.values()].map(group => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [group.lng / group.count, group.lat / group.count] },
      properties: { poi_count: group.count, categories: group.categories, cell_size_meters: cellSize },
    })),
  };
}
