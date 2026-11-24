import type { SupabaseClient } from "@supabase/supabase-js";

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type PoiCategory = "commerce" | "transport" | "education" | "health" | "recreation" | "services" | "infrastructure";

export const osmUserAgent = () =>
  `DavidBastoRealEstate/1.0 (${process.env.OSM_CONTACT_EMAIL?.trim() ? `contact: ${process.env.OSM_CONTACT_EMAIL.trim()}` : "real-estate catalogue"})`;

export function categoryFor(tags: Record<string, string>): { category: PoiCategory; subcategory: string } | null {
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
  if (shop || ["supermarket", "marketplace", "restaurant", "cafe", "bank", "atm"].includes(amenity)) {
    return { category: "commerce", subcategory: shop ? `shop=${shop}` : `amenity=${amenity}` };
  }
  if (["police", "fire_station", "post_office", "community_centre"].includes(amenity)) {
    return { category: "services", subcategory: `amenity=${amenity}` };
  }
  return null;
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
  return `[out:json][timeout:25];\n(\n${statements.join("\n")}\n);\nout center tags 300;`;
}

function overpassEndpoints() {
  const configured = process.env.OVERPASS_API_URL?.trim();
  return [...new Set([
    configured,
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ].filter((value): value is string => Boolean(value)))];
}

/** Query Overpass, trying each configured mirror until one answers. */
export async function fetchOverpassElements(lat: number, lng: number, radiusMeters: number) {
  const query = overpassQuery(lat, lng, radiusMeters);
  const failures: string[] = [];
  const deadline = Date.now() + 45_000; // stay inside the function's max duration
  for (const endpoint of overpassEndpoints()) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) { failures.push("tiempo agotado"); break; }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": osmUserAgent(),
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(Math.min(20_000, remaining)),
        cache: "no-store",
      });
      if (!response.ok) { failures.push(`${new URL(endpoint).host} ${response.status}`); continue; }
      const payload = await response.json() as { elements?: OsmElement[] };
      return { elements: payload.elements || [], endpoint, failures };
    } catch (error) {
      failures.push(`${new URL(endpoint).host} ${error instanceof Error && error.name === "TimeoutError" ? "timeout" : "error"}`);
    }
  }
  return { elements: null, endpoint: null, failures };
}

const distanceMeters = (latA: number, lngA: number, latB: number, lngB: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(latB - latA);
  const dLng = radians(lngB - lngA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

export type OsmSyncResult =
  | { ok: true; poiCount: number; analyticsSaved: boolean; geoai: unknown }
  | { ok: false; error: string };

/**
 * Import OSM points of interest around a point, store them in spatial_pois and
 * (when propertyId is given) refresh the property's territorial cache.
 * Requires an admin Supabase session (RLS).
 */
export async function syncOsmAnalytics(
  supabase: SupabaseClient,
  { propertyId, lat, lng, radiusMeters = 1000 }: { propertyId: number | null; lat: number; lng: number; radiusMeters?: number },
): Promise<OsmSyncResult> {
  const { elements, failures } = await fetchOverpassElements(lat, lng, radiusMeters);
  if (!elements) {
    if (propertyId !== null) {
      await supabase.from("property_geo_analytics").update({ status: "unavailable", updated_at: new Date().toISOString() }).eq("property_id", propertyId);
    }
    return { ok: false, error: `El servicio de puntos de interés no respondió (${failures.join(", ")}).` };
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
    if (error) return { ok: false, error: `No se pudieron guardar los puntos OSM: ${error.message}` };
  }

  const { data: geoai, error: geoaiError } = await supabase.rpc("get_location_intelligence_score", { lat, lng, radius_meters: radiusMeters });
  if (geoaiError) console.error("[osm-sync] GeoAI no disponible:", geoaiError.message);

  if (propertyId === null) return { ok: true, poiCount: pois.length, analyticsSaved: false, geoai: geoaiError ? null : geoai };

  const points = pois.flatMap(item => {
    const [pointLng, pointLat] = item.location.coordinates;
    const mappedCategory = item.category === "commerce" ? "commercial" : item.category === "recreation" ? "parks" : item.category;
    if (!["transport", "health", "education", "commercial", "parks"].includes(mappedCategory)) return [];
    const distance = distanceMeters(lat, lng, pointLat, pointLng);
    if (distance > radiusMeters) return [];
    return [{ id: item.external_id, name: item.name, category: mappedCategory, lat: pointLat, lng: pointLng, distanceMeters: distance }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  const counts = points.reduce<Record<string, number>>((acc, point) => {
    acc[point.category] = (acc[point.category] || 0) + 1;
    return acc;
  }, { transport: 0, health: 0, education: 0, commercial: 0, parks: 0 });

  const { error } = await supabase.from("property_geo_analytics").upsert({
    property_id: propertyId,
    coordinates: { type: "Point", coordinates: [lng, lat] },
    accessibility: {
      walking: { mode: "walking", method: "radial_approximation", note: "No representa una ruta por calles." },
      driving: { mode: "driving", method: "radial_approximation", note: "No representa una ruta por calles." },
      public_transport: { status: "not_available", reason: "No hay proveedor de isócronas de transporte público configurado." },
      ...(geoai && !geoaiError ? { scores: geoai } : {}),
      source: geoai && !geoaiError ? "OpenStreetMap · heuristic-v1" : "radial_approximation",
    },
    pois: { counts, points, total: points.length, truncated: elements.length >= 300 },
    search_radius_m: radiusMeters,
    source_name: "OpenStreetMap",
    source_updated_at: importedAt,
    status: "ready",
    updated_at: importedAt,
  }, { onConflict: "property_id" });
  if (error) return { ok: false, error: `Se importaron los puntos, pero no se pudo actualizar la caché territorial: ${error.message}` };
  return { ok: true, poiCount: pois.length, analyticsSaved: true, geoai: geoaiError ? null : geoai };
}
