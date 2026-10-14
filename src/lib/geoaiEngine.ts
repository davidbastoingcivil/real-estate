import type { SupabaseClient } from "@supabase/supabase-js";

export type TravelMode = "walking" | "driving";

export type LocationIntelligence = {
  radius_meters: number;
  poi_counts: Record<string, number>;
  total_pois: number;
  accessibility_score: number | null;
  commercial_density_score: number | null;
  infrastructure_growth_score: number | null;
  risk_score: number | null;
  opportunity_score: number | null;
  confidence: "no_data" | "limited" | "moderate" | "good";
  model_version: string;
  calculated_at?: string;
};

export type IsochroneFeature = {
  type: "Feature";
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
  properties: {
    requested_minutes: number;
    travel_mode: TravelMode;
    estimated_radius_meters: number;
    is_approximation: true;
    method: string;
    source_note: string;
  };
};

export type PoiHeatCell = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { poi_count: number; categories: Record<string, number>; cell_size_meters: number };
};

export type GeoAiAnalysis = {
  intelligence: LocationIntelligence;
  isochrone: IsochroneFeature;
  heatmap: { type: "FeatureCollection"; features: PoiHeatCell[]; radius_meters: number; cell_size_meters: number; method: string };
  scoring: {
    method: "weighted-spatial-heuristic" | "live-poi-counts-no-score";
    weights: { accessibility: 0.35; commercial_density: 0.3; infrastructure_growth: 0.25; risk: 0.1 };
    disclaimer: string;
  };
  warnings: string[];
};

export type GeoAiRequest = {
  lat: number;
  lng: number;
  radiusMeters?: number;
  minutes?: number;
  travelMode?: TravelMode;
};

function fallbackIsochrone(lat: number, lng: number, minutes: number, travelMode: TravelMode): IsochroneFeature {
  const speed = travelMode === "walking" ? 75 : 500;
  const estimatedRadiusMeters = minutes * speed;
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    const latitude = lat + (estimatedRadiusMeters / 111_320) * Math.sin(angle);
    const longitude = lng + (estimatedRadiusMeters / (111_320 * Math.max(Math.abs(Math.cos(lat * Math.PI / 180)), 0.05))) * Math.cos(angle);
    return [longitude, latitude];
  });
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [points] },
    properties: {
      requested_minutes: minutes,
      travel_mode: travelMode,
      estimated_radius_meters: estimatedRadiusMeters,
      is_approximation: true,
      method: "client_fallback_radial_buffer",
      source_note: "Área circular estimada; no representa una ruta por red vial.",
    },
  };
}

/** Uses PostGIS for its geometric buffer only; POIs and scores are not read or persisted. */
export async function getPropertyIsochrone(client: SupabaseClient, request: GeoAiRequest): Promise<IsochroneFeature> {
  const minutes = request.minutes ?? 10;
  const travelMode = request.travelMode ?? "walking";
  try {
    const { data, error } = await client.rpc("get_property_isochrone_buffer", {
      lat: request.lat,
      lng: request.lng,
      minutes,
      travel_mode: travelMode,
    });
    if (!error && data && typeof data === "object") return data as IsochroneFeature;
  } catch {
    // Use the documented radial approximation when PostGIS is unavailable.
  }
  return fallbackIsochrone(request.lat, request.lng, minutes, travelMode);
}
