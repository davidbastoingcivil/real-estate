import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { osmUserAgent, syncOsmAnalytics } from "@/lib/integrations/osm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type OsmAddress = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

let lastNominatimRequestAt = 0;

const response = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store, max-age=0" },
});

function addressFields(address: OsmAddress | null) {
  const parts = address?.address || {};
  return {
    display_name: address?.display_name || null,
    neighbourhood: parts.neighbourhood || parts.suburb || parts.quarter || null,
    district: parts.city_district || parts.district || null,
    municipality: parts.city || parts.town || parts.municipality || parts.village || null,
    department: parts.state || parts.region || null,
    postcode: parts.postcode || null,
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<OsmAddress | null> {
  const delay = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  lastNominatimRequestAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  const result = await fetch(url, {
    headers: { "User-Agent": osmUserAgent() },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) return null;
  return await result.json() as OsmAddress;
}

export async function POST(request: Request) {
  let body: { property_id?: number; lat?: number; lng?: number; radius_meters?: number };
  try { body = await request.json() as typeof body; }
  catch { return response({ error: "Envía coordenadas válidas en formato JSON." }, 400); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radiusMeters = Number(body.radius_meters ?? 1000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    return response({ error: "La latitud y longitud deben ser coordenadas reales." }, 400);
  }
  if (!Number.isInteger(radiusMeters) || radiusMeters < 100 || radiusMeters > 1000) {
    return response({ error: "El radio de consulta debe estar entre 100 y 1.000 metros." }, 400);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return response({ error: "Inicia sesión como administrador para consultar OpenStreetMap." }, 401);
    const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) return response({ error: "La cuenta no tiene permisos para actualizar la inteligencia territorial." }, 403);

    const propertyId = body.property_id === undefined ? null : Number(body.property_id);
    if (body.property_id !== undefined && (!Number.isSafeInteger(propertyId) || (propertyId ?? 0) < 1)) {
      return response({ error: "El identificador del inmueble no es válido." }, 400);
    }
    if (propertyId !== null) {
      const { data: property, error } = await supabase.from("properties").select("id,lat,lng").eq("id", propertyId).maybeSingle();
      if (error || !property) return response({ error: "No encontramos el inmueble que se va a actualizar." }, 404);
      if (Math.abs(Number(property.lat) - lat) > 0.00001 || Math.abs(Number(property.lng) - lng) > 0.00001) {
        return response({ error: "Las coordenadas cambiaron. Guarda de nuevo el inmueble antes de consultar su entorno." }, 409);
      }
    }

    let address: OsmAddress | null = null;
    try { address = await reverseGeocode(lat, lng); }
    catch { /* POI enrichment remains useful if Nominatim is unavailable. */ }

    const sync = await syncOsmAnalytics(supabase, { propertyId, lat, lng, radiusMeters });
    const poiWarning = sync.ok ? null : `${sync.error} Se cargó la sugerencia de dirección; puedes reintentar más tarde.`;

    return response({
      success: true,
      address: addressFields(address),
      poi_count: sync.ok ? sync.poiCount : 0,
      analytics_saved: sync.ok && sync.analyticsSaved,
      radius_meters: radiusMeters,
      geoai: sync.ok ? sync.geoai : null,
      poi_warning: poiWarning,
      source: "OpenStreetMap contributors · © OpenStreetMap contributors · ODbL",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar OpenStreetMap.";
    return response({ error: message.includes("aborted") ? "La consulta a OpenStreetMap tardó demasiado. Inténtalo de nuevo." : "No se pudo completar la consulta de OpenStreetMap." }, 503);
  }
}
