export type PoiCategory = "transport" | "health" | "education" | "commercial" | "parks";

export type LivePoi = {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  distanceMeters: number;
};

export type LivePoiCounts = Record<PoiCategory, number>;

export type LivePoiResult = {
  source: "OpenStreetMap";
  available: boolean;
  radiusMeters: number;
  fetchedAt: string;
  counts: LivePoiCounts;
  total: number;
  points: LivePoi[];
  topPoints: LivePoi[];
  truncated: boolean;
  warning: string | null;
};

export type LivePoiHeatmap = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { poi_count: number; categories: Record<string, number>; cell_size_meters: number };
  }>;
  radius_meters: number;
  cell_size_meters: number;
  method: "openstreetmap_live_aggregated_grid";
};

const MAX_ELEMENTS = 400;
const MAX_MARKERS = 10;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_SIZE = 120;
const queryCache = new Map<string, { expiresAt: number; value: LivePoiResult }>();
const pendingQueries = new Map<string, Promise<LivePoiResult>>();

const emptyCounts = (): LivePoiCounts => ({ transport: 0, health: 0, education: 0, commercial: 0, parks: 0 });

function validCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

function distanceMeters(latA: number, lngA: number, latB: number, lngB: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function categoryFor(tags: Record<string, unknown>): PoiCategory | null {
  const amenity = String(tags.amenity || "");
  const highway = String(tags.highway || "");
  const transport = String(tags.public_transport || "");
  const railway = String(tags.railway || "");
  const leisure = String(tags.leisure || "");
  const shop = String(tags.shop || "");
  const healthcare = String(tags.healthcare || "");

  if (["school", "college", "university", "kindergarten", "library"].includes(amenity)) return "education";
  if (["hospital", "clinic", "doctors", "dentist", "pharmacy"].includes(amenity) || healthcare) return "health";
  if (highway === "bus_stop" || transport || ["station", "tram_stop", "halt"].includes(railway) || amenity === "bus_station") return "transport";
  if (["park", "playground", "sports_centre", "garden", "nature_reserve"].includes(leisure)) return "parks";
  if (shop || ["marketplace", "supermarket", "restaurant", "cafe", "bank", "atm"].includes(amenity)) return "commercial";
  return null;
}

function overpassQuery(lat: number, lng: number, radiusMeters: number) {
  const selectors = [
    'nwr["amenity"~"school|college|university|kindergarten|library|hospital|clinic|doctors|dentist|pharmacy|bus_station|marketplace|supermarket|restaurant|cafe|bank|atm"]',
    'nwr["healthcare"]',
    'nwr["shop"]',
    'nwr["public_transport"]',
    'nwr["highway"~"bus_stop"]',
    'nwr["railway"~"station|tram_stop|halt"]',
    'nwr["leisure"~"park|playground|sports_centre|garden|nature_reserve"]',
  ];
  return `[out:json][timeout:7];\n(\n${selectors.map(selector => `${selector}(around:${radiusMeters},${lat},${lng});`).join("\n")}\n);\nout center tags ${MAX_ELEMENTS};`;
}

function failure(radiusMeters: number, message: string): LivePoiResult {
  return {
    source: "OpenStreetMap",
    available: false,
    radiusMeters,
    fetchedAt: new Date().toISOString(),
    counts: emptyCounts(),
    total: 0,
    points: [],
    topPoints: [],
    truncated: false,
    warning: message,
  };
}

async function requestPOIs(lat: number, lng: number, radiusMeters: number): Promise<LivePoiResult> {
  const endpoint = process.env.OVERPASS_API_URL?.trim() || "https://overpass-api.de/api/interpreter";
  let parsedEndpoint: URL;
  try { parsedEndpoint = new URL(endpoint); } catch { return failure(radiusMeters, "El servicio geográfico no está configurado correctamente."); }
  if (parsedEndpoint.protocol !== "https:") return failure(radiusMeters, "El servicio geográfico debe utilizar HTTPS.");

  try {
    const contact = process.env.OSM_CONTACT_EMAIL?.trim();
    const response = await fetch(parsedEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": `DavidBastoRealEstate/1.0${contact ? ` (contact: ${contact})` : ""}`,
      },
      body: `data=${encodeURIComponent(overpassQuery(lat, lng, radiusMeters))}`,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return failure(radiusMeters, `OpenStreetMap no está disponible temporalmente (HTTP ${response.status}).`);

    const payload = await response.json() as { elements?: Array<{
      type?: string; id?: number; lat?: number; lon?: number;
      center?: { lat?: number; lon?: number }; tags?: Record<string, unknown>;
    }> };
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    const seen = new Set<string>();
    const counts = emptyCounts();
    const points = elements.flatMap(element => {
      const category = categoryFor(element.tags || {});
      const point = element.center || element;
      const pointLat = Number(point.lat);
      const pointLng = Number(point.lon);
      const id = `${element.type || "object"}/${element.id ?? "unknown"}`;
      if (!category || !element.id || seen.has(id) || !validCoordinates(pointLat, pointLng)) return [];
      seen.add(id);
      counts[category] += 1;
      const taggedName = element.tags?.name;
      const name = typeof taggedName === "string" && taggedName.trim() ? taggedName.trim() : categoryLabel(category);
      return [{ id, name, category, lat: pointLat, lng: pointLng, distanceMeters: Math.round(distanceMeters(lat, lng, pointLat, pointLng)) }];
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);

    const truncated = elements.length >= MAX_ELEMENTS;
    return {
      source: "OpenStreetMap",
      available: true,
      radiusMeters,
      fetchedAt: new Date().toISOString(),
      counts,
      total: points.length,
      points,
      topPoints: points.slice(0, MAX_MARKERS),
      truncated,
      warning: truncated ? "La fuente alcanzó el límite de resultados; los conteos pueden estar incompletos." : null,
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return failure(radiusMeters, timedOut
      ? "La consulta a OpenStreetMap excedió el tiempo permitido; el informe continúa sin esos datos."
      : "No fue posible consultar OpenStreetMap; el informe continúa sin esos datos.");
  }
}

function categoryLabel(category: PoiCategory) {
  return ({ transport: "Transporte", health: "Salud", education: "Educación", commercial: "Comercio", parks: "Parques" })[category];
}

export async function fetchPOIsOnTheFly(lat: number, lng: number, radiusMeters = 1_000): Promise<LivePoiResult> {
  if (!validCoordinates(lat, lng)) return failure(radiusMeters, "El inmueble no tiene coordenadas válidas para consultar puntos de interés.");
  if (!Number.isInteger(radiusMeters) || radiusMeters < 100 || radiusMeters > 5_000) {
    return failure(radiusMeters, "El radio de consulta debe estar entre 100 y 5.000 metros.");
  }

  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}:${radiusMeters}`;
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) queryCache.delete(key);
  const pending = pendingQueries.get(key);
  if (pending) return pending;

  const request = requestPOIs(lat, lng, radiusMeters).then(result => {
    // Cache only successful results in this warm serverless instance; no POIs
    // are written to Supabase or another persistent store.
    if (result.available) {
      if (queryCache.size >= MAX_CACHE_SIZE) queryCache.delete(queryCache.keys().next().value as string);
      queryCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return result;
  }).finally(() => pendingQueries.delete(key));
  pendingQueries.set(key, request);
  return request;
}

export function makePoiHeatmap(points: LivePoi[], radiusMeters: number, cellSizeMeters = 400): LivePoiHeatmap {
  const groups = new Map<string, { latSum: number; lngSum: number; count: number; categories: Record<string, number> }>();
  for (const point of points) {
    const latStep = cellSizeMeters / 111_320;
    const lngStep = cellSizeMeters / (111_320 * Math.max(Math.abs(Math.cos(point.lat * Math.PI / 180)), 0.1));
    const row = Math.floor(point.lat / latStep);
    const column = Math.floor(point.lng / lngStep);
    const key = `${row}:${column}`;
    const group = groups.get(key) || { latSum: 0, lngSum: 0, count: 0, categories: {} };
    group.latSum += point.lat;
    group.lngSum += point.lng;
    group.count += 1;
    group.categories[point.category] = (group.categories[point.category] || 0) + 1;
    groups.set(key, group);
  }
  return {
    type: "FeatureCollection",
    radius_meters: radiusMeters,
    cell_size_meters: cellSizeMeters,
    method: "openstreetmap_live_aggregated_grid",
    features: [...groups.values()].map(group => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [group.lngSum / group.count, group.latSum / group.count] },
      properties: { poi_count: group.count, categories: group.categories, cell_size_meters: cellSizeMeters },
    })),
  };
}
