import { NextResponse } from "next/server";
import { getGeoAiAnalysis, refreshPropertyGeoAiMetrics, type TravelMode } from "@/lib/geoaiEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    const analysis = await getGeoAiAnalysis(supabase, { lat, lng, radiusMeters, minutes, travelMode });
    let metricsPersisted = false;
    if (property) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
        if (admin) {
          try {
            await refreshPropertyGeoAiMetrics(supabase, property.id);
            metricsPersisted = true;
          } catch {
            // The automatic database trigger remains the authoritative persisted refresh path.
          }
        }
      }
    }

    return json({ property, coordinates: { lat, lng }, metrics_persisted: metricsPersisted, ...analysis });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "El servicio de inteligencia territorial no está disponible." }, 503);
  }
}
