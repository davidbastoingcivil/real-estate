import { NextResponse } from "next/server";
import { getPropertyIsochrone, type GeoAiAnalysis, type TravelMode } from "@/lib/geoaiEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPOIsOnTheFly, makePoiHeatmap } from "@/lib/geo/overpassClient";

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
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
      return json({ error: "Envía coordenadas válidas o un property_id con ubicación registrada." }, 400);
    }

    const poiRadiusMeters = Math.min(radiusMeters, 5_000);
    const [isochrone, livePois] = await Promise.all([
      getPropertyIsochrone(supabase, { lat, lng, minutes, travelMode }),
      fetchPOIsOnTheFly(lat, lng, poiRadiusMeters),
    ]);
    const warnings = [livePois.warning].filter((warning): warning is string => Boolean(warning));
    if (poiRadiusMeters < radiusMeters) warnings.push("Los POI se consultan hasta un máximo de 5 km; el área geométrica conserva el tiempo seleccionado.");
    if (isochrone.properties.is_approximation) warnings.push("El área de influencia usa una aproximación circular, no rutas reales por la red vial.");

    const analysis: GeoAiAnalysis = {
      intelligence: {
        radius_meters: poiRadiusMeters,
        poi_counts: {
          transport: livePois.counts.transport,
          health: livePois.counts.health,
          education: livePois.counts.education,
          commerce: livePois.counts.commercial,
          recreation: livePois.counts.parks,
        },
        total_pois: livePois.total,
        accessibility_score: null,
        commercial_density_score: null,
        infrastructure_growth_score: null,
        risk_score: null,
        opportunity_score: null,
        confidence: livePois.total >= 50 ? "good" : livePois.total >= 15 ? "moderate" : livePois.total > 0 ? "limited" : "no_data",
        model_version: "openstreetmap-live-v1",
        calculated_at: livePois.fetchedAt,
      },
      isochrone,
      heatmap: makePoiHeatmap(livePois.points, poiRadiusMeters) as GeoAiAnalysis["heatmap"],
      scoring: {
        method: "live-poi-counts-no-score",
        weights: { accessibility: 0.35, commercial_density: 0.3, infrastructure_growth: 0.25, risk: 0.1 },
        disclaimer: "Conteos de POI consultados en vivo desde OpenStreetMap; no se calculan puntajes consolidados de riesgo o valorización sin capas oficiales verificadas.",
      },
      warnings,
    };

    return json({
      property,
      coordinates: { lat, lng },
      poiSource: livePois.available ? livePois.source : "No disponible",
      poiFetchedAt: livePois.fetchedAt,
      poiWarning: livePois.warning,
      livePoiCounts: livePois.counts,
      ...analysis,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "El servicio de inteligencia territorial no está disponible." }, 503);
  }
}
