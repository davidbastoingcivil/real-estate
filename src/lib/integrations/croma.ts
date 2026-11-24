// Shared Croma client (IGAC + DANE public data for Colombia).
// Server-only: requires CROMA_API_KEY, never expose it to the browser.

export type JsonRecord = Record<string, unknown>;

export const asObject = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;

export const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const stringOrNull = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export function cromaConfigured() {
  return Boolean(process.env.CROMA_API_KEY?.trim());
}

export async function cromaPost(path: string, body: JsonRecord, timeoutMs = 15_000): Promise<JsonRecord> {
  const key = process.env.CROMA_API_KEY?.trim();
  if (!key) throw new Error("Croma no está configurado (CROMA_API_KEY).");
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`https://api.croma.run${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 500 && attempt === 1) { lastError = new Error(`Croma respondió ${response.status}.`); continue; }
      if (!response.ok) throw new Error(`Croma respondió ${response.status}.`);
      const payload = await response.json() as JsonRecord;
      // Croma envelopes successful responses inside `data`.
      return asObject(payload.data) ?? payload;
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (!retryable || attempt === 2) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Croma no respondió.");
}

const normalizeName = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\b(d\.?\s?c\.?|distrito capital|ciudad)\b/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Resolve a DIVIPOLA code (5 digits) from a municipality name and optional department. */
export async function resolveMunicipalityCode(municipality: string, department?: string | null) {
  const name = municipality.split(",")[0]?.trim();
  if (!name || name.length < 3) return null;
  const payload = await cromaPost("/co/dane/census-municipalities/v1", { query: name, page: 1, per_page: 10 });
  const results = (Array.isArray(payload.results) ? payload.results : []).map(asObject).filter((row): row is JsonRecord => Boolean(row));
  const wanted = normalizeName(name);
  const wantedDepartment = department ? normalizeName(department) : "";
  const candidates = results.filter(row => normalizeName(String(row.territory_name || "")) === wanted);
  const pool = candidates.length ? candidates : results.length === 1 ? results : [];
  const match = pool.find(row => !wantedDepartment || normalizeName(String(row.department_name || "")).includes(wantedDepartment) || wantedDepartment.includes(normalizeName(String(row.department_name || "")))) || (pool.length === 1 ? pool[0] : null);
  const code = typeof match?.territory_code === "string" && /^\d{5}$/.test(match.territory_code) ? match.territory_code : null;
  return code ? { code, municipality: String(match?.territory_name || name), department: String(match?.department_name || "") } : null;
}

export type CadastralLookup = {
  method: "cadastral_id" | "coordinates" | "none";
  found: boolean | null;
  property: JsonRecord | null;
  checkedAt: string | null;
  servedFrom: string | null;
};

export async function lookupCadastralByNumber(cadastralNumber: string): Promise<CadastralLookup> {
  const payload = await cromaPost("/co/igac/property/v1", { cadastral_number: cadastralNumber });
  return {
    method: "cadastral_id",
    found: typeof payload.found === "boolean" ? payload.found : null,
    property: asObject(payload.property),
    checkedAt: stringOrNull(payload.checked_at),
    servedFrom: stringOrNull(payload.served_from),
  };
}

export async function lookupCadastralByPoint(lat: number, lng: number): Promise<CadastralLookup> {
  const payload = await cromaPost("/co/igac/property-by-point/v1", { latitude: lat, longitude: lng });
  return {
    method: "coordinates",
    found: typeof payload.found === "boolean" ? payload.found : null,
    property: asObject(payload.property),
    checkedAt: stringOrNull(payload.checked_at),
    servedFrom: stringOrNull(payload.served_from),
  };
}

export type TerritorialData = {
  asOf: string | null;
  census: {
    year: number | null; population: number | null; households: number | null; dwellings: number | null;
    stratumDistribution: Record<string, number> | null;
  } | null;
  ipm: { year: number | null; total: number | null; urban: number | null; rural: number | null } | null;
  cadastralStats: {
    year: number | null; manager: string | null; propertyCount: number | null; appraisalTotal: number | null;
    urbanStatus: string | null; urbanUpdateYear: number | null;
  } | null;
  errors: string[];
};

/** Municipal indicators: DANE census + IPM and IGAC cadastral statistics (latest year, urban + rural). */
export async function fetchTerritorialData(municipalityCode: string): Promise<TerritorialData> {
  const [census, ipm, stats] = await Promise.allSettled([
    cromaPost("/co/dane/census-municipalities/v1", { territory_code: municipalityCode, page: 1, per_page: 1 }),
    cromaPost("/co/dane/municipal-ipm/v1", { territory_code: municipalityCode, page: 1, per_page: 1 }),
    cromaPost("/co/igac/municipal-statistics/v1", { municipality_code: municipalityCode }),
  ]);
  const errors: string[] = [];
  const first = (payload: JsonRecord | null) => asObject((Array.isArray(payload?.results) ? payload.results : [])[0]);

  let censusData: TerritorialData["census"] = null;
  let asOf: string | null = null;
  if (census.status === "fulfilled") {
    const row = first(census.value);
    asOf = stringOrNull(census.value.as_of);
    if (row) {
      const totalOf = (value: unknown) => numberOrNull(asObject(value)?.total ?? value);
      const stratum = asObject(row.estrato);
      censusData = {
        year: numberOrNull(row.year),
        population: totalOf(row.population),
        households: totalOf(row.households),
        dwellings: totalOf(row.dwellings),
        stratumDistribution: stratum ? Object.fromEntries(Object.entries(stratum).flatMap(([key, value]) => {
          const count = numberOrNull(value);
          return count === null ? [] : [[key, count]];
        })) : null,
      };
    }
  } else errors.push("census");

  let ipmData: TerritorialData["ipm"] = null;
  if (ipm.status === "fulfilled") {
    const row = first(ipm.value);
    if (row) ipmData = { year: numberOrNull(row.year), total: numberOrNull(row.ipm), urban: numberOrNull(row.ipm_urban), rural: numberOrNull(row.ipm_rural) };
  } else errors.push("ipm");

  let statsData: TerritorialData["cadastralStats"] = null;
  if (stats.status === "fulfilled") {
    const rows = (Array.isArray(stats.value.results) ? stats.value.results : []).map(asObject).filter((row): row is JsonRecord => Boolean(row));
    const latestYear = Math.max(...rows.map(row => numberOrNull(row.year) ?? 0));
    const latest = rows.filter(row => numberOrNull(row.year) === latestYear);
    if (latest.length) {
      const urban = latest.find(row => row.zone === "urban") || latest[0];
      const sum = (key: string) => latest.reduce<number | null>((total, row) => {
        const value = numberOrNull(row[key]);
        return value === null ? total : (total ?? 0) + value;
      }, null);
      statsData = {
        year: latestYear || null,
        manager: stringOrNull(urban.cadastral_manager),
        propertyCount: sum("property_count"),
        appraisalTotal: sum("appraisal_total"),
        urbanStatus: stringOrNull(urban.urban_status),
        urbanUpdateYear: numberOrNull(urban.urban_update_year),
      };
    }
  } else errors.push("cadastral_stats");

  return { asOf, census: censusData, ipm: ipmData, cadastralStats: statsData, errors };
}

/** IGAC only serves parcels of municipalities whose cadastral manager is IGAC. */
export function managerIsIgac(manager: string | null | undefined) {
  if (!manager) return true; // unknown: try anyway
  return /\bIGAC\b|Instituto Geogr[aá]fico Agust[ií]n Codazzi/i.test(manager);
}
