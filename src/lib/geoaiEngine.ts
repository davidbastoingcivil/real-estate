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
    method: "weighted-spatial-heuristic";
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

const weights = { accessibility: 0.35, commercial_density: 0.3, infrastructure_growth: 0.25, risk: 0.1 } as const;

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

export function calculateOpportunityScore(metrics: Pick<LocationIntelligence,
  "accessibility_score" | "commercial_density_score" | "infrastructure_growth_score" | "risk_score" | "total_pois"
>): number | null {
  if (!metrics.total_pois) return null;
  const access = metrics.accessibility_score ?? 0;
  const commerce = metrics.commercial_density_score ?? 0;
  const infrastructure = metrics.infrastructure_growth_score ?? 0;
  const risk = metrics.risk_score ?? 0;
  return Math.round(Math.max(0, Math.min(100,
    weights.accessibility * access
    + weights.commercial_density * commerce
    + weights.infrastructure_growth * infrastructure
    - weights.risk * risk,
  )) * 100) / 100;
}

export async function getGeoAiAnalysis(client: SupabaseClient, request: GeoAiRequest): Promise<GeoAiAnalysis> {
  const radiusMeters = request.radiusMeters ?? 1500;
  const minutes = request.minutes ?? 10;
  const travelMode = request.travelMode ?? "walking";

  const [scoreResult, bufferResult, heatmapResult] = await Promise.allSettled([
    client.rpc("get_location_intelligence_score", {
      lat: request.lat,
      lng: request.lng,
      radius_meters: radiusMeters,
    }),
    client.rpc("get_property_isochrone_buffer", {
      lat: request.lat,
      lng: request.lng,
      minutes,
      travel_mode: travelMode,
    }),
    client.rpc("get_location_intelligence_heatmap", {
      lat: request.lat,
      lng: request.lng,
      radius_meters: radiusMeters,
      cell_size_meters: 400,
    }),
  ]);

  const warnings: string[] = [];
  const scoreData = scoreResult.status === "fulfilled" && !scoreResult.value.error ? scoreResult.value.data : null;
  if (!scoreData) warnings.push("Los indicadores de puntos de interés no están disponibles para esta ubicación.");
  const metrics = (scoreData || {
    radius_meters: radiusMeters, poi_counts: {}, total_pois: 0, accessibility_score: null,
    commercial_density_score: null, infrastructure_growth_score: null, risk_score: null,
    opportunity_score: null, confidence: "no_data", model_version: "fallback-v1",
  }) as LocationIntelligence;
  const bufferData = bufferResult.status === "fulfilled" && !bufferResult.value.error ? bufferResult.value.data : null;
  if (!bufferData) warnings.push("El área de influencia se muestra como un radio estimado, no como una ruta real.");
  const buffer = (bufferData || fallbackIsochrone(request.lat, request.lng, minutes, travelMode)) as IsochroneFeature;
  const heatmapData = heatmapResult.status === "fulfilled" && !heatmapResult.value.error ? heatmapResult.value.data : null;
  if (!heatmapData) warnings.push("La capa de densidad no pudo consultarse; el mapa base y el inmueble siguen disponibles.");
  const heatmap = (heatmapData || { type: "FeatureCollection", features: [], radius_meters: radiusMeters, cell_size_meters: 400, method: "no_data" }) as GeoAiAnalysis["heatmap"];

  return {
    intelligence: { ...metrics, opportunity_score: calculateOpportunityScore(metrics) },
    isochrone: buffer,
    heatmap,
    scoring: {
      method: "weighted-spatial-heuristic",
      weights,
      disclaimer: "Indicador heurístico a partir de POI cargados y clasificados; no es una predicción de precios ni una isócrona de red vial.",
    },
    warnings,
  };
}

/** Refreshes the persisted snapshot; the database RPC permits this only to an admin. */
export async function refreshPropertyGeoAiMetrics(client: SupabaseClient, propertyId: number): Promise<void> {
  const { error } = await client.rpc("refresh_property_geoai_metrics", { target_property_id: propertyId });
  if (error) throw new Error(`No se pudieron actualizar las métricas del inmueble: ${error.message}`);
}
