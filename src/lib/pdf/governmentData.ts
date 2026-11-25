import type { CadastralProperty, CadastralReportData } from "@/lib/pdf/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsPoiCounts, analyticsPoiPoints } from "@/lib/geo/propertyAnalytics";
import { makePoiHeatmap, type LivePoiResult } from "@/lib/geo/overpassClient";
import { buildStaticMap } from "@/lib/pdf/staticMap";
import {
  asObject, cromaConfigured, fetchTerritorialData, lookupCadastralByNumber, lookupCadastralByPoint,
  managerIsIgac, numberOrNull, type CadastralLookup, type JsonRecord, type TerritorialData,
} from "@/lib/integrations/croma";

type PoiCell = CadastralReportData["geoSpatialContext"]["poiCells"][number];

export class CadastralValidationError extends Error {}

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const CACHE_STATUSES = new Set(["verified", "not_found", "manager_not_igac", "no_identifier"]);

type OfficialSnapshot = {
  source: "cache" | "live";
  origin: "croma" | "catastro_bogota" | null;
  details: JsonRecord | null;
  status: string | null;
  message: string | null;
  method: CadastralLookup["method"];
  found: boolean | null;
  parcel: JsonRecord | null;
  checkedAt: string | null;
  servedFrom: string | null;
  manager: string | null;
  territorial: TerritorialData | null;
};

function territorialFromCache(value: unknown): TerritorialData | null {
  const row = asObject(value);
  if (!row || !Object.keys(row).length) return null;
  return {
    asOf: text(row.as_of),
    census: asObject(row.census) as TerritorialData["census"],
    ipm: asObject(row.ipm) as TerritorialData["ipm"],
    cadastralStats: asObject(row.cadastral_stats) as TerritorialData["cadastralStats"],
    errors: Array.isArray(row.errors) ? row.errors.map(String) : [],
  };
}

/** Prefer the data the admin sync stored; fall back to live Croma queries. */
async function officialSnapshot(property: CadastralProperty, supabase: SupabaseClient, municipalityCode: string | null, validPoint: boolean): Promise<OfficialSnapshot> {
  const { data: cache } = await supabase.from("property_official_data").select("*").eq("property_id", property.id).maybeSingle();
  // Ignore a cache written for another municipality (e.g. the listing moved).
  const cacheMatches = cache && (!municipalityCode || !cache.municipality_code || cache.municipality_code === municipalityCode);
  if (cache && cacheMatches && CACHE_STATUSES.has(String(cache.status))) {
    const verified = cache.status === "verified";
    const origin = cache.source === "catastro_bogota" ? "catastro_bogota" as const : "croma" as const;
    const cachedTerritorial = territorialFromCache(cache.territorial);
    return {
      source: "cache",
      origin,
      details: origin === "catastro_bogota" ? asObject(cache.details) : null,
      status: String(cache.status),
      message: text(cache.message),
      method: (cache.lookup_method as CadastralLookup["method"]) || "none",
      found: verified ? true : cache.status === "not_found" ? false : null,
      parcel: verified ? {
        cadastral_number: cache.cadastral_number, previous_cadastral_number: cache.previous_cadastral_number,
        municipality_code: cache.municipality_code, municipality: cache.municipality, address: cache.address,
        appraisal: cache.appraisal, built_area_m2: cache.built_area_m2, land_area_m2: cache.land_area_m2,
        economic_destination: cache.economic_destination, vigencia: cache.vigencia, buildings: cache.buildings,
      } : null,
      checkedAt: text(cache.source_checked_at) || text(cache.synced_at),
      servedFrom: origin === "catastro_bogota" ? "archivo de Catastro Bogotá (UAECD)" : "caché sincronizada desde Croma (IGAC/DANE)",
      manager: text(cache.cadastral_manager),
      territorial: cachedTerritorial ?? (municipalityCode && cromaConfigured() ? await fetchTerritorialData(municipalityCode).catch(() => null) : null),
    };
  }

  const empty: OfficialSnapshot = { source: "live", origin: null, details: null, status: null, message: null, method: "none", found: null, parcel: null, checkedAt: null, servedFrom: null, manager: null, territorial: null };
  if (!cromaConfigured()) return { ...empty, message: "CROMA_API_KEY no está configurada en el servidor." };

  const territorial = municipalityCode ? await fetchTerritorialData(municipalityCode).catch(() => null) : null;
  const manager = territorial?.cadastralStats?.manager ?? null;
  const npn = [property.national_cadastral_number, property.cadastral_id]
    .map(value => (value || "").replace(/\D/g, "")).find(value => /^\d{30}$/.test(value)) || null;
  let lookup: CadastralLookup | null = null;
  try {
    if (npn) lookup = await lookupCadastralByNumber(npn);
    if ((!lookup || lookup.found !== true) && validPoint && managerIsIgac(manager)) lookup = await lookupCadastralByPoint(property.lat, property.lng);
  } catch { /* reported below as a warning */ }
  return {
    ...empty,
    origin: "croma",
    status: lookup ? (lookup.found ? "verified" : "not_found") : !managerIsIgac(manager) ? "manager_not_igac" : null,
    method: lookup?.method ?? "none",
    found: lookup?.found ?? null,
    parcel: lookup?.found ? lookup.property : null,
    checkedAt: lookup?.checkedAt ?? null,
    servedFrom: lookup?.servedFrom ?? null,
    manager,
    territorial,
  };
}

function bogotaSummary(details: JsonRecord): NonNullable<CadastralReportData["officialData"]["bogota"]> {
  const str = (key: string) => text(details[key]);
  const num = (key: string) => numberOrNull(details[key]);
  const uses = Array.isArray(details.uses) ? details.uses.map(asObject).filter((item): item is JsonRecord => Boolean(item)) : [];
  const quality = asObject(details.qualification) || {};
  return {
    chip: str("chip"),
    cadastralId: str("cadastralId"),
    nationalCadastralNumber: str("nationalCadastralNumber"),
    officialAddress: str("officialAddress"),
    additionalAddress: str("additionalAddress"),
    neighbourhood: str("neighbourhood"),
    neighbourhoodCode: str("neighbourhoodCode"),
    lotAreaM2: num("lotAreaM2"),
    builtAreaM2: num("builtAreaM2"),
    parcelType: str("parcelType"),
    parcelClass: str("parcelClass"),
    economicDestination: str("economicDestination"),
    horizontalProperty: str("horizontalProperty"),
    housingUse: str("housingUse"),
    uses: uses.slice(0, 6).map(item => ({ use: text(item.use) || "Uso sin nombre", areaM2: numberOrNull(item.areaM2) })),
    constructionYear: num("constructionYear"),
    ageYears: num("ageYears"),
    formationYear: num("formationYear"),
    updateYear: num("updateYear"),
    incorporationDate: str("incorporationDate"),
    physicalHomogeneousZone: str("physicalHomogeneousZone"),
    qualificationScore: num("qualificationScore"),
    qualification: Object.fromEntries(Object.entries(quality).filter(([, value]) => typeof value === "string")) as Record<string, string>,
  };
}

export async function getGovernmentReportData(property: CadastralProperty, supabase: SupabaseClient) {
  const warnings: string[] = [];
  const coordinatesValid = Number.isFinite(property.lat) && property.lat >= -90 && property.lat <= 90
    && Number.isFinite(property.lng) && property.lng >= -180 && property.lng <= 180
    && !(property.lat === 0 && property.lng === 0);
  const declaredMunicipalityCode = property.municipality_code?.trim() || null;
  if (declaredMunicipalityCode && !/^\d{5}$/.test(declaredMunicipalityCode)) {
    throw new CadastralValidationError("El código DIVIPOLA registrado en la ficha no tiene cinco dígitos. Corrígelo antes de generar el informe.");
  }

  const [snapshot, analyticsResult] = await Promise.all([
    officialSnapshot(property, supabase, declaredMunicipalityCode, coordinatesValid),
    supabase.from("property_geo_analytics")
      .select("accessibility,pois,urban_norm,search_radius_m,source_name,source_updated_at,status,updated_at")
      .eq("property_id", property.id)
      .maybeSingle(),
  ]);

  const geoCache = analyticsResult.error ? null : analyticsResult.data as Record<string, unknown> | null;
  const storedPois = geoCache?.pois && typeof geoCache.pois === "object" ? geoCache.pois as Record<string, unknown> : {};
  const storedPoints = analyticsPoiPoints(storedPois.points);
  const storedCounts = analyticsPoiCounts(storedPois.counts);
  const livePois: LivePoiResult | null = geoCache?.status === "ready" && typeof geoCache.source_updated_at === "string" ? {
    source: "OpenStreetMap",
    available: true,
    radiusMeters: Number(geoCache.search_radius_m) || 1000,
    fetchedAt: geoCache.source_updated_at,
    counts: storedCounts,
    total: Number(storedPois.total) || storedPoints.length,
    points: storedPoints,
    topPoints: storedPoints.slice(0, 10),
    truncated: storedPois.truncated === true,
    warning: storedPois.truncated === true ? "La fuente limitó los puntos guardados; el conteo puede ser parcial." : null,
  } : null;

  // Parcel data is only used when it belongs to the declared municipality.
  let parcel = snapshot.parcel;
  const parcelMunicipalityCode = text(parcel?.municipality_code);
  if (parcel && declaredMunicipalityCode && parcelMunicipalityCode && parcelMunicipalityCode !== declaredMunicipalityCode) {
    warnings.push(`La consulta catastral identificó un predio en ${text(parcel.municipality) || parcelMunicipalityCode} (${parcelMunicipalityCode}), distinto del municipio de la ficha (${declaredMunicipalityCode}). Se omitieron sus datos; revisa las coordenadas.`);
    parcel = null;
  }
  const municipalityCode = declaredMunicipalityCode || parcelMunicipalityCode;
  const municipality = text(parcel?.municipality) || property.municipality;

  const territorial = snapshot.territorial;
  const census = territorial?.census ?? null;
  const ipm = territorial?.ipm ?? null;
  const stats = territorial?.cadastralStats ?? null;
  const manager = snapshot.manager ?? stats?.manager ?? null;

  const poiSearchRadiusUsed = Number(geoCache?.search_radius_m) || 1_000;
  const poiCounts = livePois?.counts || { transport: 0, commercial: 0, health: 0, education: 0, parks: 0 };
  const poiHeatmap = makePoiHeatmap(livePois?.points || [], poiSearchRadiusUsed, 300);
  const poiCells: PoiCell[] = poiHeatmap.features.map(feature => ({
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    count: feature.properties.poi_count,
  }));

  // Warnings, most useful first.
  if (snapshot.status === "manager_not_igac" || (!parcel && manager && !managerIsIgac(manager))) {
    warnings.push(`El catastro de ${municipality || "este municipio"} lo administra ${manager || "un gestor distinto del IGAC"}; el IGAC no publica sus predios. Avalúo, áreas y número predial deben tomarse del certificado catastral.`);
  } else if (snapshot.status === "not_found" || snapshot.found === false) {
    warnings.push(snapshot.method === "cadastral_id" ? "El Número Predial Nacional registrado no aparece en el IGAC." : "No hay un predio IGAC en las coordenadas registradas.");
  } else if (snapshot.origin === "catastro_bogota") {
    // Imported from the official district file: no extra warning.
  } else if (snapshot.status === "verified" && snapshot.method === "coordinates") {
    warnings.push("Predio identificado por coordenadas: confirma con el certificado catastral que corresponde al inmueble.");
  } else if (!snapshot.status) {
    warnings.push(snapshot.message || "No fue posible consultar los registros catastrales en este momento.");
  }
  if (!municipalityCode) warnings.push("La ficha no tiene código DIVIPOLA: guárdala de nuevo en el panel para resolverlo automáticamente.");
  else if (!census || !ipm) warnings.push("Algunos indicadores municipales DANE no están disponibles para este código territorial.");
  if (analyticsResult.error) warnings.push("La caché territorial no está disponible para este informe.");
  else if (coordinatesValid && !livePois) warnings.push("El análisis de puntos de interés aún no está guardado: usa “Sincronizar” en el panel de administración.");
  if (livePois?.warning) warnings.push(livePois.warning);
  if (!coordinatesValid) warnings.push("Este inmueble no tiene coordenadas válidas para mostrar el mapa ni consultar puntos de interés.");

  const mapResult = await buildStaticMap(property.lat, property.lng, livePois?.topPoints || []);
  if (!mapResult.image) warnings.push(`Mapa no disponible: ${mapResult.reason || "No se obtuvo una imagen."}`);

  const reportedCadastralNumber = (text(parcel?.cadastral_number) || "").replace(/\D/g, "");
  const cadastralNumber = /^\d{30}$/.test(reportedCadastralNumber) ? reportedCadastralNumber : null;
  const vigencia = asObject(parcel?.vigencia);
  const buildings = Array.isArray(parcel?.buildings) ? parcel.buildings.map(asObject).filter((item): item is JsonRecord => Boolean(item)) : [];

  const data: CadastralReportData = {
    metadata: {
      reportId: `DB-${property.id}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      issueDate: new Date().toISOString(),
      requestedBy: "Usuario de la plataforma",
      evaluator: "David Basto Real Estate · Informe automatizado de consulta pública",
      isMacroLotWarning: snapshot.method === "coordinates",
    },
    subjectProperty: {
      id: property.id,
      title: property.title,
      address: property.location,
      description: property.description,
      price: property.price,
      municipalityCode,
      type: property.type,
      listedAreaM2: property.area,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      coordinates: coordinatesValid ? { lat: property.lat, lng: property.lng } : null,
      legal: {
        cadastralId: property.cadastral_id || "No registrado",
        chip: property.chip || "No registrado",
        nationalCadastralNumber: property.national_cadastral_number || cadastralNumber || "No disponible",
        realEstateId: property.real_estate_registration || "No registrado",
      },
      stratum: property.stratum !== null && property.stratum !== undefined ? `Estrato ${property.stratum}` : "No registrado",
      garages: Number(property.garage_spaces || 0),
      deposits: Number(property.deposits || 0),
      dossierSections: property.dossier?.sections || [],
      mainImageBase64: null,
      galleryImagesBase64: [],
      staticMapBase64: mapResult.image,
      mapUnavailableReason: mapResult.reason,
      mapAttribution: mapResult.attribution ?? null,
    },
    officialData: {
      recordFound: parcel ? true : snapshot.found,
      lookupMethod: snapshot.method,
      cadastralNumber,
      cadastralAppraisal: numberOrNull(property.cadastral_appraisal) ?? numberOrNull(parcel?.appraisal),
      officialBuiltArea: numberOrNull(property.official_built_area) ?? numberOrNull(parcel?.built_area_m2),
      officialLotArea: numberOrNull(property.official_lot_area) ?? numberOrNull(parcel?.land_area_m2),
      economicDestination: text(parcel?.economic_destination),
      stratum: property.stratum !== null && property.stratum !== undefined ? `Estrato ${property.stratum} (ficha)` : "Sin dato",
      municipality,
      municipalityCode,
      checkedAt: snapshot.checkedAt,
      servedFrom: snapshot.servedFrom,
      cadastralManager: manager,
      parcelAddress: text(parcel?.address),
      cadastralUpdate: vigencia ? {
        status: text(vigencia.status),
        updateYear: numberOrNull(vigencia.update_year),
        yearsSinceUpdate: numberOrNull(vigencia.years_since_update),
        zone: text(vigencia.zone),
      } : stats ? { status: stats.urbanStatus, updateYear: stats.urbanUpdateYear, yearsSinceUpdate: null, zone: "urban" } : null,
      buildings: buildings.slice(0, 6).map(item => ({
        use: text(item.use) || "Sin uso registrado",
        areaM2: numberOrNull(item.area_m2),
        floors: numberOrNull(item.floors),
        bathrooms: numberOrNull(item.bathrooms),
      })),
      bogota: snapshot.origin === "catastro_bogota" && snapshot.details ? bogotaSummary(snapshot.details) : null,
      municipalStatistics: stats ? {
        year: stats.year,
        appraisalTotal: stats.appraisalTotal,
        propertyCount: stats.propertyCount,
      } : null,
    },
    geoSpatialContext: {
      // No municipal POT API is integrated yet; never invent zoning values.
      potNormative: {
        landUse: "Sin dato normativo POT verificado",
        maxHeight: "Sin dato normativo POT verificado",
        treatment: "Sin dato normativo POT verificado",
      },
      poiCounts,
      poiCells,
      poiSearchRadiusUsed,
      poiAvailable: Boolean(livePois?.available),
      poiStatus: !coordinatesValid
        ? "Sin coordenadas válidas"
        : !livePois?.available
          ? "Pendiente de sincronización"
          : livePois.total === 0
            ? "Sin puntos registrados en el radio consultado"
            : `${livePois.total} puntos registrados en el radio consultado`,
      poiSource: livePois?.available ? "OpenStreetMap" : "No disponible",
      poiFetchedAt: livePois?.available ? livePois.fetchedAt : null,
      dane: {
        municipality: municipality || null,
        municipalityCode,
        ipmUrban: ipm?.urban ?? null,
        ipmRural: ipm?.rural ?? null,
        censusAvailable: census !== null,
        ipmAvailable: ipm !== null,
        asOf: territorial?.asOf ?? null,
        censusYear: census?.year ?? null,
        population: census?.population ?? null,
        households: census?.households ?? null,
        dwellings: census?.dwellings ?? null,
        municipalStratumDistribution: census?.stratumDistribution ?? null,
        ipm: ipm?.total ?? null,
      },
    },
    warnings,
    client: null,
    financialSimulation: null,
    predictiveAnalysis: {
      physicalRisks: { landslide: "No disponible en las fuentes consultadas", flooding: "No disponible en las fuentes consultadas" },
      capitalGainCatalysts: [],
    },
  };
  return data;
}

/**
 * Embed only photos that belong to this listing: videos, foreign hosts and any
 * file also used by another property (shared stock or promotional art) are skipped.
 */
export async function addReportImage(data: CadastralReportData, images: string[], supabase?: SupabaseClient) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return data;
  let allowedHost: string;
  try { allowedHost = new URL(supabaseUrl).host; } catch { return data; }
  const candidates = images.filter(value => !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(value)).slice(0, 6);
  const shared = supabase ? await Promise.all(candidates.map(async url => {
    const { count, error } = await supabase.from("properties").select("id", { count: "exact", head: true })
      .contains("images", [url]).neq("id", data.subjectProperty.id);
    return !error && (count ?? 0) > 0;
  })) : candidates.map(() => false);
  const imageUrls = candidates.filter((_, index) => !shared[index]).slice(0, 3);
  if (!imageUrls.length) return data;
  for (const imageUrl of imageUrls) try {
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
    if (!isSupabaseImage && !isUnsplashImage && !isDriveThumbnail) continue;
    const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(2500), cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !/^image\/(jpeg|png)$/i.test(contentType) || length > 5_000_000) continue;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5_000_000) continue;
    data.subjectProperty.galleryImagesBase64.push(Buffer.from(bytes));
  } catch {
    // La falta de una imagen no debe bloquear el reporte.
  }
  data.subjectProperty.mainImageBase64 = data.subjectProperty.galleryImagesBase64[0] || null;
  return data;
}
