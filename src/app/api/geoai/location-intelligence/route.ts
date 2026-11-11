import { NextResponse } from "next/server";
import { estimatePropertyIsochrone, type GeoAiAnalysis, type TravelMode } from "@/lib/geoaiEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyticsHeatmap, analyticsPoiCounts, analyticsPoiPoints } from "@/lib/geo/propertyAnalytics";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store, max-age=0" },
});

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function scoreValue(scores: Record<string, unknown>, key: string): number | null {
  const value = scores[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const propertyId = params.get("property_id");
  const radiusMeters = positiveInteger(params.get("radius_meters"), 1500, 50000);
  const minutes = positiveInteger(params.get("minutes"), 10, 60);
  const travelMode = (params.get("travel_mode") || "walking") as TravelMode;

  if (radiusMeters === null || radiusMeters < 100 || minutes === null) {
    return json({ error: "El radio debe ser de 100 a 50.000 m y el tiempo de 1 a 60 minutos." }, 400);
  }
  if (travelMode !== "walking" && travelMode !== "driving") {
    return json({ error: "travel_mode debe ser walking o driving." }, 400);
  }

  let lat = params.has("lat") ? Number(params.get("lat")) : Number.NaN;
  let lng = params.has("lng") ? Number(params.get("lng")) : Number.NaN;
  const parsedPropertyId = propertyId === null ? null : Number(propertyId);
  if (propertyId !== null && (!Number.isSafeInteger(parsedPropertyId) || (parsedPropertyId ?? 0) <= 0)) {
    return json({ error: "property_id debe ser un identificador válido." }, 400);
  }

  try {
    const supabase = await createSupabaseServerClient();
    let property: { id: number; title: string } | null = null;
    let analytics: Record<string, unknown> | null = null;

    if (parsedPropertyId !== null) {
      const { data, error } = await supabase.from("properties")
        .select("id,title,lat,lng")
        .eq("id", parsedPropertyId)
        .eq("is_published", true)
        .maybeSingle();
      if (error) return json({ error: "No fue posible consultar ese inmueble." }, 500);
      if (!data) return json({ error: "No se encontró un inmueble publicado con ese identificador." }, 404);
      property = { id: Number(data.id), title: data.title };
      lat = Number(data.lat);
      lng = Number(data.lng);
      const cached = await supabase.from("property_geo_analytics")
        .select("accessibility,pois,urban_norm,search_radius_m,source_name,source_updated_at,status,updated_at")
        .eq("property_id", parsedPropertyId as number)
        .maybeSingle();
      if (cached.error && cached.error.code !== "42P01" && cached.error.code !== "PGRST205") {
        return json({ error: "No fue posible leer la caché territorial." }, 503);
      }
      analytics = cached.data as Record<string, unknown> | null;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
      return json({ error: "Envía coordenadas válidas o un property_id con ubicación registrada." }, 400);
    }

    const poiRadiusMeters = Math.min(radiusMeters, 5_000);
    const storedRadius = Number(analytics?.search_radius_m) || 0;
    const poiData = analytics?.pois && typeof analytics.pois === "object" ? analytics.pois as Record<string, unknown> : {};
    const accessibility = analytics?.accessibility && typeof analytics.accessibility === "object" ? analytics.accessibility as Record<string, unknown> : {};
    const scores = accessibility.scores && typeof accessibility.scores === "object" ? accessibility.scores as Record<string, unknown> : {};
    const allPoints = analyticsPoiPoints(poiData.points);
    const points = allPoints.filter(point => point.distanceMeters <= poiRadiusMeters);
    const counts = analyticsPoiCounts(points.reduce<Record<string, number>>((total, point) => {
      total[point.category] = (total[point.category] || 0) + 1;
      return total;
    }, {}));
    const total = points.length;
    const isochrone = estimatePropertyIsochrone(lat, lng, minutes, travelMode);
    const poiAvailable = analytics?.status === "ready" && Boolean(analytics.source_updated_at);
    const poiWarning = poiAvailable
      ? (storedRadius < poiRadiusMeters ? `La caché territorial cubre ${storedRadius.toLocaleString("es-CO")} m; solicita una actualización para ampliar el radio.` : null)
      : "Los datos de puntos de interés se están preparando para este inmueble.";
    const warnings: string[] = [];
    if (poiWarning) warnings.push(poiWarning);
    if (isochrone.properties.is_approximation) warnings.push("El área de influencia usa una aproximación circular, no rutas reales por la red vial.");

    const analysis: GeoAiAnalysis = {
      intelligence: {
        radius_meters: storedRadius || poiRadiusMeters,
        poi_counts: {
          transport: counts.transport,
          health: counts.health,
          education: counts.education,
          commerce: counts.commercial,
          recreation: counts.parks,
        },
        total_pois: total,
        accessibility_score: scoreValue(scores, "accessibility_score"),
        commercial_density_score: scoreValue(scores, "commercial_density_score"),
        infrastructure_growth_score: scoreValue(scores, "infrastructure_growth_score"),
        risk_score: scoreValue(scores, "risk_score"),
        opportunity_score: scoreValue(scores, "opportunity_score"),
        confidence: total >= 50 ? "good" : total >= 15 ? "moderate" : total > 0 ? "limited" : "no_data",
        model_version: typeof scores.model_version === "string" ? scores.model_version : poiAvailable ? "supabase-property-cache-v1" : "no-data-v1",
        calculated_at: typeof analytics?.source_updated_at === "string" ? analytics.source_updated_at : undefined,
      },
      isochrone,
      heatmap: analyticsHeatmap(points, poiRadiusMeters) as GeoAiAnalysis["heatmap"],
      scoring: {
        method: "live-poi-counts-no-score",
        weights: { accessibility: 0.35, commercial_density: 0.3, infrastructure_growth: 0.25, risk: 0.1 },
        disclaimer: "Conteos provenientes de la última consulta persistida a OpenStreetMap. La cobertura depende de la fecha y radio de actualización; no se calculan puntajes de riesgo o valorización sin capas oficiales verificadas.",
      },
      warnings,
    };

    return json({
      property,
      coordinates: { lat, lng },
      poiSource: poiAvailable ? String(analytics?.source_name || "OpenStreetMap") : "No disponible",
      poiFetchedAt: typeof analytics?.source_updated_at === "string" ? analytics.source_updated_at : null,
      poiWarning,
      livePoiCounts: counts,
      geoAnalytics: {
        status: analytics?.status || "pending",
        updatedAt: analytics?.updated_at || null,
        searchRadiusMeters: storedRadius,
        accessibility,
        urbanNorm: analytics?.urban_norm || {},
      },
      ...analysis,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "El servicio de inteligencia territorial no está disponible." }, 503);
  }
}
