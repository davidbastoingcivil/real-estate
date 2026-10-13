import type { SupabaseClient } from "@supabase/supabase-js";

export type AvmProperty = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  area: number;
  type: string;
  location: string;
  municipality: string | null;
  department: string | null;
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  images: string[];
};

export type AvmComparable = {
  id: number;
  title: string;
  price: number;
  area_m2: number;
  price_per_m2: number;
  distance_meters: number;
  stratum: number | null;
  rooms: number;
  bathrooms: number;
  similarity_score: number;
  negotiation_factor: number;
  area_factor: number;
  adjusted_price_per_m2: number;
  adjusted_estimated_value: number;
};

export type AvmResult = {
  property: AvmProperty;
  valuation_date: string;
  estimated_value: number;
  value_per_m2: number;
  value_min: number;
  value_max: number;
  confidence_score: number;
  estimated_rent: number;
  cap_rate: number;
  monthly_rent_rate: number;
  comparables: AvmComparable[];
  geoai: {
    accessibility_score: number | null;
    commercial_density_score: number | null;
    infrastructure_growth_score: number | null;
    risk_score: number | null;
    opportunity_score: number | null;
    confidence: string | null;
    adjustment_percent: number;
  };
  methodology: {
    negotiation_factor: number;
    area_exponent: number;
    max_distance_meters: number;
    comparable_count: number;
    dispersion_percent: number;
    description: string;
  };
  limitations: string[];
};

type ComparableRow = Omit<AvmComparable, "negotiation_factor" | "area_factor" | "adjusted_price_per_m2" | "adjusted_estimated_value">;
type GeoRow = {
  accessibility_score: number | null;
  commercial_density_score: number | null;
  infrastructure_growth_score: number | null;
  risk_score: number | null;
  opportunity_score: number | null;
  confidence: string | null;
};

const NEGOTIATION_FACTOR = 0.93;
const AREA_EXPONENT = 0.15;
const MAX_DISTANCE_METERS = 1500;
const RENT_RATE = 0.0055;
const RANGE_LOWER = 0.25;
const RANGE_UPPER = 0.75;

const round = (value: number) => Math.round(value * 100) / 100;
const percentile = (values: number[], quantile: number) => {
  if (!values.length) return 0;
  const position = (values.length - 1) * quantile;
  const lower = Math.floor(position);
  const fraction = position - lower;
  const left = values[lower];
  const right = values[Math.min(lower + 1, values.length - 1)];
  return left + (right - left) * fraction;
};

function calculateGeoAiAdjustment(geo: GeoRow | null) {
  if (!geo) return 0;
  const present = [geo.accessibility_score, geo.commercial_density_score, geo.infrastructure_growth_score, geo.risk_score]
    .filter((value): value is number => typeof value === "number");
  if (!present.length) return 0;
  const access = (geo.accessibility_score ?? 50) - 50;
  const commerce = (geo.commercial_density_score ?? 50) - 50;
  const infrastructure = (geo.infrastructure_growth_score ?? 50) - 50;
  const risk = (geo.risk_score ?? 50) - 50;
  return Math.max(-0.05, Math.min(0.05, (0.35 * access + 0.3 * commerce + 0.2 * infrastructure - 0.15 * risk) / 100));
}

function confidenceScore(values: number[]) {
  if (values.length < 2) return Math.round(values.length * 8);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const sampleFactor = Math.min(1, values.length / 8);
  const dispersionFactor = Math.max(0.2, 1 - Math.min(coefficientOfVariation, 0.8));
  return Math.round(100 * sampleFactor * dispersionFactor);
}

export function calculateValuation(
  property: AvmProperty,
  comparableRows: ComparableRow[],
  geoRow: GeoRow | null,
  valuationDate = new Date().toISOString(),
): AvmResult {
  const comparables = comparableRows.filter(row =>
    Number.isFinite(row.price_per_m2) && row.price_per_m2 > 0
    && Number.isFinite(row.area_m2) && row.area_m2 > 0,
  ).map(row => {
    const areaFactor = Math.max(0.85, Math.min(1.15, (property.area / row.area_m2) ** AREA_EXPONENT));
    const adjustedPricePerM2 = row.price_per_m2 * NEGOTIATION_FACTOR * areaFactor;
    return {
      ...row,
      negotiation_factor: NEGOTIATION_FACTOR,
      area_factor: round(areaFactor),
      adjusted_price_per_m2: round(adjustedPricePerM2),
      adjusted_estimated_value: round(adjustedPricePerM2 * property.area),
    };
  });

  const geoAdjustment = calculateGeoAiAdjustment(geoRow);
  const weightedValues = comparables.map(comparable => ({
    value: comparable.adjusted_estimated_value,
    weight: Math.max(0.05, comparable.similarity_score / 100) / (1 + comparable.distance_meters / 750),
  }));
  const totalWeight = weightedValues.reduce((sum, row) => sum + row.weight, 0);
  const marketEstimate = totalWeight > 0
    ? weightedValues.reduce((sum, row) => sum + row.value * row.weight, 0) / totalWeight
    : property.price;
  const estimatedValue = marketEstimate * (1 + geoAdjustment);
  const ordered = comparables.map(row => row.adjusted_estimated_value).sort((a, b) => a - b);
  const valueMin = ordered.length ? percentile(ordered, RANGE_LOWER) * (1 + geoAdjustment) : estimatedValue * 0.9;
  const valueMax = ordered.length ? percentile(ordered, RANGE_UPPER) * (1 + geoAdjustment) : estimatedValue * 1.1;
  const valuePerM2 = property.area > 0 ? estimatedValue / property.area : 0;
  const estimatedRent = estimatedValue * RENT_RATE;
  const capRate = estimatedValue > 0 ? estimatedRent * 12 / estimatedValue : 0;
  const valueMean = ordered.length ? ordered.reduce((sum, value) => sum + value, 0) / ordered.length : 0;
  const dispersionPercent = valueMean > 0
    ? round(Math.sqrt(ordered.reduce((sum, value) => sum + (value - valueMean) ** 2, 0) / ordered.length) / valueMean * 100)
    : 0;

  return {
    property,
    valuation_date: valuationDate,
    estimated_value: round(estimatedValue),
    value_per_m2: round(valuePerM2),
    value_min: round(Math.min(valueMin, estimatedValue)),
    value_max: round(Math.max(valueMax, estimatedValue)),
    confidence_score: confidenceScore(ordered),
    estimated_rent: round(estimatedRent),
    cap_rate: round(capRate * 100),
    monthly_rent_rate: RENT_RATE * 100,
    comparables,
    geoai: {
      accessibility_score: geoRow?.accessibility_score ?? null,
      commercial_density_score: geoRow?.commercial_density_score ?? null,
      infrastructure_growth_score: geoRow?.infrastructure_growth_score ?? null,
      risk_score: geoRow?.risk_score ?? null,
      opportunity_score: geoRow?.opportunity_score ?? null,
      confidence: geoRow?.confidence ?? null,
      adjustment_percent: round(geoAdjustment * 100),
    },
    methodology: {
      negotiation_factor: NEGOTIATION_FACTOR,
      area_exponent: AREA_EXPONENT,
      max_distance_meters: MAX_DISTANCE_METERS,
      comparable_count: comparables.length,
      dispersion_percent: dispersionPercent,
      description: "Promedio ponderado por similitud y distancia de ofertas publicadas, ajustado por negociación, escala de área y señales GeoAI disponibles.",
    },
    limitations: [
      "Estimación automática orientativa; no es un avalúo comercial certificado ni reemplaza una inspección física.",
      "La muestra usa anuncios publicados, que pueden diferir de precios de cierre y no constituye una base transaccional oficial.",
      "Edad, conservación, estrato, parqueaderos, depósitos, administración y uso del suelo no están disponibles de forma estructurada y no se ajustaron.",
      comparables.length < 3
        ? "Hay menos de tres comparables compatibles; la confianza estadística es baja y el resultado debe interpretarse con cautela."
        : "La confianza depende del tamaño y dispersión de la muestra; no es una probabilidad estadística de valor exacto.",
      geoRow?.confidence === "no_data" || !geoRow
        ? "No se hallaron indicadores GeoAI disponibles; no se aplicó ajuste territorial."
        : "El ajuste territorial es heurístico y depende de la cobertura y calidad de los puntos de interés cargados.",
    ],
  };
}

export async function calculatePropertyValuation(client: SupabaseClient, propertyId: string | number): Promise<AvmResult> {
  const id = Number(propertyId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");

  const { data: row, error: propertyError } = await client.from("properties")
    .select("id,title,slug,description,price,area,type,location,municipality,lat,lng,bedrooms,bathrooms,images,is_published")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (propertyError) throw new Error(`No se pudo consultar el inmueble: ${propertyError.message}`);
  if (!row) throw new Error("No se encontró un inmueble publicado con ese identificador.");

  const property: AvmProperty = {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    area: Number(row.area),
    type: row.type,
    location: row.location,
    municipality: row.municipality,
    department: null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    bedrooms: Number(row.bedrooms || 0),
    bathrooms: Number(row.bathrooms || 0),
    images: Array.isArray(row.images) ? row.images.filter((image): image is string => typeof image === "string") : [],
  };
  if (!Number.isFinite(property.area) || property.area <= 0 || !Number.isFinite(property.price) || property.price <= 0) {
    throw new Error("El inmueble debe tener área y precio mayores que cero para generar una estimación.");
  }

  const hasCoordinates = Number.isFinite(property.lat) && Number.isFinite(property.lng)
    && property.lat >= -90 && property.lat <= 90 && property.lng >= -180 && property.lng <= 180
    && !(property.lat === 0 && property.lng === 0);
  const [comparablesResult, authResult] = await Promise.all([
    hasCoordinates ? client.rpc("get_avm_comparables", {
      target_lat: property.lat,
      target_lng: property.lng,
      target_type: property.type,
      target_area: property.area,
      max_distance_meters: MAX_DISTANCE_METERS,
      limit_count: 10,
      target_property_id: property.id,
    }) : Promise.resolve({ data: [], error: null }),
    client.auth.getUser(),
  ]);
  if (comparablesResult.error) throw new Error(`Falló la búsqueda de inmuebles comparables: ${comparablesResult.error.message}`);

  let geoRow: GeoRow | null = null;
  if (authResult.data.user) {
    const { data: admin } = await client.from("admin_users").select("user_id").eq("user_id", authResult.data.user.id).maybeSingle();
    if (admin) {
      const { data } = await client.from("properties_geoai_metrics")
        .select("accessibility_score,commercial_density_score,infrastructure_growth_score,risk_score,opportunity_score,confidence")
        .eq("property_id", property.id)
        .maybeSingle();
      if (data) geoRow = data as GeoRow;
    }
  }

  const comparableRows = (comparablesResult.data || []).map((comparable: Record<string, unknown>) => ({
    id: Number(comparable.id),
    title: String(comparable.title),
    price: Number(comparable.price),
    area_m2: Number(comparable.area_m2),
    price_per_m2: Number(comparable.price_per_m2),
    distance_meters: Number(comparable.distance_meters),
    stratum: comparable.stratum === null ? null : Number(comparable.stratum),
    rooms: Number(comparable.rooms || 0),
    bathrooms: Number(comparable.bathrooms || 0),
    similarity_score: Number(comparable.similarity_score),
  }));
  return calculateValuation(property, comparableRows, geoRow);
}

export async function savePropertyValuation(client: SupabaseClient, valuation: AvmResult, evaluatorUserId: string) {
  const { data, error } = await client.from("property_valuations").insert({
    property_id: valuation.property.id,
    estimated_value: valuation.estimated_value,
    value_per_m2: valuation.value_per_m2,
    value_min: valuation.value_min,
    value_max: valuation.value_max,
    confidence_score: valuation.confidence_score,
    estimated_rent: valuation.estimated_rent,
    cap_rate: valuation.cap_rate,
    valuation_data_json: valuation,
    evaluator_user_id: evaluatorUserId,
  }).select("id").single();
  if (error) throw new Error(`La estimación se calculó, pero no se guardó en el historial: ${error.message}`);
  return String(data.id);
}
