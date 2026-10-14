import type { SupabaseClient } from "@supabase/supabase-js";
import type { CadastralProperty, CadastralReportData } from "@/lib/pdf/types";
import { fetchPOIsOnTheFly, makePoiHeatmap, type LivePoi } from "@/lib/geo/overpassClient";

type JsonRecord = Record<string, unknown>;
type PoiCell = CadastralReportData["geoSpatialContext"]["poiCells"][number];

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const asObject = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;

function firstResult(payload: JsonRecord) {
  const results = Array.isArray(payload.results) ? payload.results : [];
  return asObject(results[0]);
}

async function cromaPost(path: string, body: JsonRecord): Promise<JsonRecord> {
  const key = process.env.CROMA_API_KEY?.trim();
  if (!key) throw new Error("Croma no está configurado.");
  const response = await fetch(`https://api.croma.run${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Croma respondió ${response.status}.`);
  const payload = await response.json() as JsonRecord;
  // Croma envelopes successful API responses inside `data`; normalize once so
  // the report can read the documented `found`, `property` and `results` fields.
  return asObject(payload.data) ?? payload;
}

async function lookupCadastral(property: CadastralProperty) {
  const cadastralId = (property.cadastral_id || "").trim();
  const normalized = cadastralId.replace(/[^\d]/g, "");
  // The public IGAC portal supports legacy 20-digit identifiers, but Croma's
  // property endpoint currently validates cadastral_number as 30 digits.
  // Keep zeroes intact and only send identifiers this API accepts.
  const cromaCadastralNumber = /^\d{30}$/.test(normalized);
  let identifierMiss: JsonRecord | null = null;
  if (cromaCadastralNumber) {
    try {
      const byNumber = await cromaPost("/co/igac/property/v1", { cadastral_number: normalized });
      if (byNumber.found === true && asObject(byNumber.property)) return { payload: byNumber, method: "cadastral_id" as const };
      if (byNumber.found === false) identifierMiss = byNumber;
    } catch {
      // Una consulta por identificador no debe impedir el fallback a coordenadas.
    }
  }

  const lat = Number(property.lat);
  const lng = Number(property.lng);
  const validCoordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
  if (validCoordinates) {
    try {
      const byPoint = await cromaPost("/co/igac/property-by-point/v1", { latitude: lat, longitude: lng });
      return { payload: byPoint, method: "coordinates" as const };
    } catch {
      return { payload: identifierMiss, method: identifierMiss ? "cadastral_id" as const : "none" as const };
    }
  }
  return { payload: identifierMiss, method: identifierMiss ? "cadastral_id" as const : cadastralId ? "cadastral_id" as const : "none" as const };
}

function encodePolyline(points: Array<[number, number]>) {
  let previousLat = 0;
  let previousLng = 0;
  let result = "";
  const encode = (value: number) => {
    let current = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (current >= 0x20) {
      chunk += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
      current >>= 5;
    }
    return chunk + String.fromCharCode(current + 63);
  };
  for (const [lng, lat] of points) {
    const scaledLat = Math.round(lat * 1e5);
    const scaledLng = Math.round(lng * 1e5);
    result += encode(scaledLat - previousLat) + encode(scaledLng - previousLng);
    previousLat = scaledLat;
    previousLng = scaledLng;
  }
  return result;
}

function staticMapUrl(lat: number, lng: number, points: LivePoi[], token: string, includeRadius: boolean) {
  const coordinate = (value: number) => Number(value.toFixed(6)).toString();
  const circle = includeRadius ? Array.from({ length: 25 }, (_, index) => {
    const angle = index / 24 * Math.PI * 2;
    const dLat = 1_000 / 111_320;
    const dLng = 1_000 / (111_320 * Math.max(Math.abs(Math.cos(lat * Math.PI / 180)), 0.1));
    return [lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)] as [number, number];
  }) : null;
  const radiusOverlay = circle ? `path-3+d4af37-0.9+10251d-0.15(${encodeURIComponent(encodePolyline(circle))})` : null;
  const overlays = [
    `pin-l+d4af37(${coordinate(lng)},${coordinate(lat)})`,
    ...points.map(point => `pin-s+3b82f6(${coordinate(point.lng)},${coordinate(point.lat)})`),
    ...(radiusOverlay ? [radiusOverlay] : []),
  ].join(",");
  const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlays}/auto/900x520@2x`);
  url.searchParams.set("access_token", token);
  return url.toString();
}

async function fetchStaticMapImage(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4_500) });
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !/^image\/(png|jpeg)$/i.test(contentType) || length > 4_000_000) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 4_000_000) return null;
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

async function buildStaticMap(property: CadastralProperty, points: LivePoi[]) {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const lat = Number(property.lat);
  const lng = Number(property.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null;

  const nearest = points.slice(0, 10);
  let candidate: string | null = null;
  let markerCount = nearest.length;
  for (; markerCount >= 0; markerCount -= 1) {
    const current = staticMapUrl(lat, lng, nearest.slice(0, markerCount), token, true);
    if (current.length <= 1_800) { candidate = current; break; }
  }
  if (!candidate) {
    const withoutRadius = staticMapUrl(lat, lng, [], token, false);
    if (withoutRadius.length > 1_800) return null;
    candidate = withoutRadius;
  }
  const image = await fetchStaticMapImage(candidate);
  if (image) return image;
  if (markerCount > 0) {
    const propertyOnly = staticMapUrl(lat, lng, [], token, true);
    if (propertyOnly.length <= 1_800) {
      const retry = await fetchStaticMapImage(propertyOnly);
      if (retry) return retry;
    }
  }
  const noRadius = staticMapUrl(lat, lng, [], token, false);
  return noRadius.length <= 1_800 ? fetchStaticMapImage(noRadius) : null;
}

export async function getGovernmentReportData(property: CadastralProperty, supabase: SupabaseClient) {
  const warnings: string[] = [];
  const coordinatesValid = Number.isFinite(property.lat) && property.lat >= -90 && property.lat <= 90
    && Number.isFinite(property.lng) && property.lng >= -180 && property.lng <= 180
    && !(property.lat === 0 && property.lng === 0);
  const cadastralLookup = await lookupCadastral(property);
  const officialProperty = cadastralLookup.payload ? asObject(cadastralLookup.payload.property) : null;
  const municipalityCode = typeof officialProperty?.municipality_code === "string" ? officialProperty.municipality_code : null;
  const municipality = typeof officialProperty?.municipality === "string" ? officialProperty.municipality : property.municipality;

  const [livePoiResult, censusResult, ipmResult, municipalStatsResult] = await Promise.allSettled([
    coordinatesValid ? fetchPOIsOnTheFly(property.lat, property.lng, 1_000) : Promise.resolve(null),
    municipalityCode && /^\d{5}$/.test(municipalityCode) ? cromaPost("/co/dane/census-municipalities/v1", { territory_code: municipalityCode, page: 1, per_page: 1 }) : Promise.resolve(null),
    municipalityCode && /^\d{5}$/.test(municipalityCode) ? cromaPost("/co/dane/municipal-ipm/v1", { territory_code: municipalityCode, page: 1, per_page: 1 }) : Promise.resolve(null),
    municipalityCode && /^\d{5}$/.test(municipalityCode) ? cromaPost("/co/igac/municipal-statistics/v1", { municipality_code: municipalityCode }) : Promise.resolve(null),
  ]);
  const livePois = livePoiResult.status === "fulfilled" ? livePoiResult.value : null;
  const poiSearchRadiusUsed = 1_000;
  const poiCounts = livePois?.counts || { transport: 0, commercial: 0, health: 0, education: 0, parks: 0 };
  const poiHeatmap = makePoiHeatmap(livePois?.points || [], poiSearchRadiusUsed, 300);
  const poiCells: PoiCell[] = poiHeatmap.features.map(feature => ({
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    count: feature.properties.poi_count,
  }));

  const census = censusResult.status === "fulfilled" ? censusResult.value : null;
  const censusRow = census ? firstResult(census) : null;
  const population = asObject(censusRow?.population);
  const households = asObject(censusRow?.households);
  const dwellings = asObject(censusRow?.dwellings);
  const stratum = asObject(censusRow?.estrato);
  const ipm = ipmResult.status === "fulfilled" ? firstResult(ipmResult.value || {}) : null;
  const statsPayload = municipalStatsResult.status === "fulfilled" ? municipalStatsResult.value : null;
  const municipalStats = statsPayload ? firstResult(statsPayload) : null;
  const distribution = stratum ? Object.fromEntries(Object.entries(stratum).flatMap(([key, value]) => {
    const count = numberOrNull(value);
    return count === null ? [] : [[key, count]];
  })) : null;

  if (!cadastralLookup.payload) warnings.push("No fue posible consultar los registros catastrales del IGAC en este momento.");
  else if (cadastralLookup.payload.found === false) warnings.push("No se encontraron registros públicos para esta cédula catastral o ubicación.");
  if (censusResult.status === "rejected" || ipmResult.status === "rejected") warnings.push("No se pudieron consultar algunos indicadores territoriales del DANE.");
  if (municipalStatsResult.status === "rejected") warnings.push("No fue posible obtener las estadísticas municipales catastrales del IGAC.");
  if (municipalityCode && (!census || !ipm)) warnings.push("Los indicadores municipales DANE no están disponibles para este código territorial.");
  if (coordinatesValid && livePois?.warning) warnings.push(livePois.warning);
  if (!coordinatesValid) warnings.push("Este inmueble no tiene coordenadas válidas para mostrar el mapa ni consultar puntos de interés.");
  const normalizedCadastralId = (property.cadastral_id || "").replace(/[^\d]/g, "");
  if (cadastralLookup.method === "coordinates" && property.cadastral_id && /^\d{20}$/.test(normalizedCadastralId)) {
    warnings.push("El número predial antiguo de 20 dígitos es válido en el portal del IGAC, pero la API de Croma requiere el número predial nacional de 30 dígitos para buscar por número; se consultó por coordenadas.");
  } else if (cadastralLookup.method === "coordinates" && property.cadastral_id && !/^\d{30}$/.test(normalizedCadastralId)) {
    warnings.push("La API de Croma requiere el número predial nacional de 30 dígitos para buscar por número; se consultó por coordenadas como alternativa.");
  }
  const requestedMunicipality = (property.municipality || property.location).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const returnedMunicipality = (municipality || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (cadastralLookup.method === "coordinates" && cadastralLookup.payload?.found === true && requestedMunicipality && returnedMunicipality && !returnedMunicipality.includes(requestedMunicipality.split(",")[0].trim())) {
    warnings.push(`La consulta por coordenadas identificó ${municipality}, pero el inmueble está registrado en ${property.municipality || property.location}. Verifica las coordenadas antes de usar este resultado en la tasación.`);
  }

  const found = typeof cadastralLookup.payload?.found === "boolean" ? cadastralLookup.payload.found : null;
  const mapBase64 = await buildStaticMap(property, livePois?.topPoints || []);
  if (coordinatesValid && !mapBase64) warnings.push("El mapa satelital no está disponible; las demás secciones del informe se generaron normalmente.");
  const cadastralNumber = typeof officialProperty?.cadastral_number === "string" ? officialProperty.cadastral_number : null;
  const data: CadastralReportData = {
    metadata: {
      reportId: `DB-${property.id}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      issueDate: new Date().toISOString(),
      requestedBy: "Usuario de la plataforma",
      evaluator: "David Basto Real Estate · Informe automatizado de consulta pública",
      isMacroLotWarning: cadastralLookup.method === "coordinates",
    },
    subjectProperty: {
      id: property.id,
      title: property.title,
      address: property.location,
      type: property.type,
      listedAreaM2: property.area,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      coordinates: coordinatesValid ? { lat: property.lat, lng: property.lng } : null,
      legal: { cadastralId: property.cadastral_id || cadastralNumber || "No registrado", realEstateId: "No registrado" },
      mainImageBase64: null,
      staticMapBase64: mapBase64,
    },
    officialData: {
      recordFound: found,
      lookupMethod: cadastralLookup.method,
      cadastralNumber,
      cadastralAppraisal: numberOrNull(officialProperty?.appraisal),
      officialBuiltArea: numberOrNull(officialProperty?.built_area_m2),
      officialLotArea: numberOrNull(officialProperty?.land_area_m2),
      economicDestination: typeof officialProperty?.economic_destination === "string" ? officialProperty.economic_destination : null,
      stratum: "Sin dato",
      municipality,
      municipalityCode,
      checkedAt: typeof cadastralLookup.payload?.checked_at === "string" ? cadastralLookup.payload.checked_at : null,
      servedFrom: typeof cadastralLookup.payload?.served_from === "string" ? cadastralLookup.payload.served_from : null,
      municipalStatistics: municipalStats ? {
        year: numberOrNull(municipalStats.year),
        appraisalTotal: numberOrNull(municipalStats.appraisal_total),
        propertyCount: numberOrNull(municipalStats.property_count),
      } : null,
    },
    geoSpatialContext: {
      // The current Croma/IGAC point lookup does not provide a point-specific municipal POT certificate.
      potNormative: {
        landUse: "Sin dato normativo POT verificado",
        maxHeight: "Sin dato normativo POT verificado",
        treatment: "Sin dato normativo POT verificado",
      },
      poiCounts,
      poiCells,
      poiSearchRadiusUsed,
      poiSource: livePois?.available ? "OpenStreetMap" : "No disponible",
      poiFetchedAt: livePois?.available ? livePois.fetchedAt : null,
      dane: {
        asOf: typeof census?.as_of === "string" ? census.as_of : null,
        censusYear: numberOrNull(censusRow?.year),
        population: numberOrNull(population?.total),
        households: numberOrNull(households?.total),
        dwellings: numberOrNull(dwellings?.total),
        municipalStratumDistribution: distribution,
        ipm: numberOrNull(ipm?.ipm),
      },
    },
    warnings,
    predictiveAnalysis: {
      physicalRisks: { landslide: "No disponible en las fuentes consultadas", flooding: "No disponible en las fuentes consultadas" },
      capitalGainCatalysts: [],
    },
  };
  return data;
}

export async function addReportImage(data: CadastralReportData, images: string[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return data;
  let allowedHost: string;
  try { allowedHost = new URL(supabaseUrl).host; } catch { return data; }
  const imageUrl = images.find(value => !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(value));
  if (!imageUrl) return data;
  try {
    const original = new URL(imageUrl);
    const isDriveLink = original.protocol === "https:" && ["drive.google.com", "www.drive.google.com"].includes(original.hostname);
    const driveId = original.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || original.searchParams.get("id");
    const parsed = isDriveLink && driveId
      ? new URL(`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`)
      : original;
    const isSupabaseImage = parsed.protocol === "https:" && parsed.host === allowedHost
      && parsed.pathname.startsWith("/storage/v1/object/public/property-images/");
    const isUnsplashImage = parsed.protocol === "https:" && parsed.host === "images.unsplash.com";
    const isDriveThumbnail = parsed.protocol === "https:" && parsed.hostname === "drive.google.com" && parsed.pathname === "/thumbnail" && Boolean(driveId);
    if (!isSupabaseImage && !isUnsplashImage && !isDriveThumbnail) return data;
    const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(2500), cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !/^image\/(jpeg|png)$/i.test(contentType) || length > 5_000_000) return data;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5_000_000) return data;
    data.subjectProperty.mainImageBase64 = Buffer.from(bytes);
  } catch {
    // La falta de una imagen no debe bloquear el reporte.
  }
  return data;
}
