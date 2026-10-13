import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OsmAddress = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

type PoiCategory = "commerce" | "transport" | "education" | "health" | "recreation" | "services" | "infrastructure";

let lastNominatimRequestAt = 0;

const response = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store, max-age=0" },
});

function categoryFor(tags: Record<string, string>): { category: PoiCategory; subcategory: string } | null {
  const amenity = tags.amenity || "";
  const highway = tags.highway || "";
  const publicTransport = tags.public_transport || "";
  const railway = tags.railway || "";
  const leisure = tags.leisure || "";
  const shop = tags.shop || "";

  if (["school", "college", "university", "kindergarten", "library"].includes(amenity)) return { category: "education", subcategory: `amenity=${amenity}` };
  if (["hospital", "clinic", "doctors", "dentist", "pharmacy", "healthcare"].includes(amenity) || tags.healthcare) {
    return { category: "health", subcategory: `amenity=${amenity || tags.healthcare}` };
  }
  if (highway === "bus_stop" || publicTransport || ["station", "tram_stop", "halt"].includes(railway) || amenity === "bus_station") {
    return { category: "transport", subcategory: highway ? `highway=${highway}` : publicTransport ? `public_transport=${publicTransport}` : railway ? `railway=${railway}` : `amenity=${amenity}` };
  }
  if (leisure) return { category: "recreation", subcategory: `leisure=${leisure}` };
  if (["trunk", "primary", "secondary"].includes(highway)) return { category: "infrastructure", subcategory: `highway=${highway}` };
  if (shop || ["supermarket", "marketplace", "restaurant", "cafe", "bank", "atm", "marketplace"].includes(amenity)) {
    return { category: "commerce", subcategory: shop ? `shop=${shop}` : `amenity=${amenity}` };
  }
  if (["police", "fire_station", "post_office", "community_centre"].includes(amenity)) {
    return { category: "services", subcategory: `amenity=${amenity}` };
  }
  return null;
}

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
  const contact = process.env.OSM_CONTACT_EMAIL?.trim() || "davidbasto.ingcivil@gmail.com";
  const result = await fetch(url, {
    headers: { "User-Agent": `DavidBastoRealEstate/1.0 (contact: ${contact})` },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) return null;
  return await result.json() as OsmAddress;
}

function overpassQuery(lat: number, lng: number, radiusMeters: number) {
  const tags = [
    '["amenity"~"school|college|university|kindergarten|library|hospital|clinic|doctors|dentist|pharmacy|bus_station|supermarket|marketplace|restaurant|cafe|bank|atm|police|fire_station|post_office|community_centre"]',
    '["highway"~"bus_stop|trunk|primary|secondary"]',
    '["public_transport"]',
    '["railway"~"station|tram_stop|halt"]',
    '["leisure"~"park|playground|sports_centre|garden"]',
    '["shop"]',
  ];
  const statements = tags.flatMap(tag => ["node", "way", "relation"].map(kind => `  ${kind}${tag}(around:${radiusMeters},${lat},${lng});`));
  return `[out:json][timeout:20];\n(\n${statements.join("\n")}\n);\nout center tags 200;`;
}

export async function POST(request: Request) {
  let body: { lat?: number; lng?: number; radius_meters?: number };
  try { body = await request.json() as typeof body; }
  catch { return response({ error: "Envía coordenadas válidas en formato JSON." }, 400); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radiusMeters = Number(body.radius_meters ?? 500);
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

    let address: OsmAddress | null = null;
    try { address = await reverseGeocode(lat, lng); }
    catch { /* POI enrichment remains useful if Nominatim is unavailable. */ }

    const query = overpassQuery(lat, lng, radiusMeters);
    const overpassEndpoint = process.env.OVERPASS_API_URL?.trim() || "https://overpass-api.de/api/interpreter";
    let elements: OsmElement[] = [];
    let poiWarning = "";
    try {
      const overpass = await fetch(overpassEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": `DavidBastoRealEstate/1.0 (contact: ${process.env.OSM_CONTACT_EMAIL?.trim() || "davidbasto.ingcivil@gmail.com"})`,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20_000),
      });
      if (!overpass.ok) poiWarning = `El servicio de puntos de interés respondió ${overpass.status}; se cargó la sugerencia de dirección y puedes reintentar más tarde.`;
      else {
        const payload = await overpass.json() as { elements?: OsmElement[] };
        elements = payload.elements || [];
      }
    } catch {
      poiWarning = "El servicio de puntos de interés no respondió; se cargó la sugerencia de dirección y puedes reintentar más tarde.";
    }
    const seen = new Set<string>();
    const importedAt = new Date().toISOString();
    const pois = elements.flatMap(element => {
      const tags = element.tags || {};
      const mapped = categoryFor(tags);
      const point = element.center || (Number.isFinite(element.lat) && Number.isFinite(element.lon) ? { lat: element.lat as number, lon: element.lon as number } : null);
      const externalId = `${element.type}/${element.id}`;
      if (!mapped || !point || seen.has(externalId)) return [];
      seen.add(externalId);
      return [{
        external_id: externalId,
        name: tags.name?.trim() || mapped.subcategory,
        category: mapped.category,
        subcategory: mapped.subcategory,
        source_name: "OpenStreetMap",
        source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        source_updated_at: importedAt,
        location: { type: "Point", coordinates: [point.lon, point.lat] },
        attributes: { ...tags, osm_type: element.type, osm_id: element.id },
      }];
    });

    for (let index = 0; index < pois.length; index += 50) {
      const { error } = await supabase.from("spatial_pois").upsert(pois.slice(index, index + 50), { onConflict: "source_name,external_id" });
      if (error) return response({ error: `No se pudieron guardar los puntos OSM: ${error.message}`, address: addressFields(address) }, 500);
    }

    const { data: geoai, error: geoaiError } = await supabase.rpc("get_location_intelligence_score", {
      lat, lng, radius_meters: radiusMeters,
    });
    if (geoaiError) console.error("No se pudo actualizar la lectura GeoAI después de importar OSM:", geoaiError.message);

    return response({
      success: true,
      address: addressFields(address),
      poi_count: pois.length,
      radius_meters: radiusMeters,
      geoai: geoaiError ? null : geoai,
      poi_warning: poiWarning || null,
      source: "OpenStreetMap contributors · © OpenStreetMap contributors · ODbL",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar OpenStreetMap.";
    return response({ error: message.includes("aborted") ? "La consulta a OpenStreetMap tardó demasiado. Inténtalo de nuevo." : "No se pudo completar la consulta de OpenStreetMap." }, 503);
  }
}
