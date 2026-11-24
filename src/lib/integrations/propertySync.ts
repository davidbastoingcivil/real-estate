import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cromaConfigured, fetchTerritorialData, lookupCadastralByNumber, lookupCadastralByPoint,
  managerIsIgac, numberOrNull, resolveMunicipalityCode, type CadastralLookup, type TerritorialData,
} from "@/lib/integrations/croma";
import { syncOsmAnalytics } from "@/lib/integrations/osm";

export type OfficialStatus = "pending" | "verified" | "not_found" | "manager_not_igac" | "no_identifier" | "error";

export type PropertySyncSummary = {
  propertyId: number;
  municipalityCode: string | null;
  official: { status: OfficialStatus; message: string | null } | { skipped: true };
  osm: { ok: boolean; message: string | null } | { skipped: true };
};

type PropertyRecord = {
  id: number; lat: number | string | null; lng: number | string | null;
  municipality: string | null; municipality_code: string | null; ["ubicación"]: string | null;
  cadastral_id: string | null; national_cadastral_number: string | null;
};

const validPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

function territorialJson(data: TerritorialData | null) {
  return data ? { as_of: data.asOf, census: data.census, ipm: data.ipm, cadastral_stats: data.cadastralStats, errors: data.errors } : {};
}

/**
 * Pull official data (Croma: IGAC + DANE) and OpenStreetMap context for one property
 * and store it in Supabase. Requires an admin session (RLS). Safe to run in `after()`.
 * Without `force`, sources are only queried when the cached data is pending.
 */
export async function syncPropertyIntegrations(
  supabase: SupabaseClient,
  propertyId: number,
  { force = false }: { force?: boolean } = {},
): Promise<PropertySyncSummary> {
  const { data: row, error } = await supabase.from("properties")
    .select("id,lat,lng,municipality,municipality_code,ubicación,cadastral_id,national_cadastral_number")
    .eq("id", propertyId).maybeSingle();
  if (error || !row) throw new Error(error?.message || "No se encontró el inmueble para sincronizar.");
  const property = row as unknown as PropertyRecord;
  const lat = Number(property.lat);
  const lng = Number(property.lng);
  const hasPoint = validPoint(lat, lng);

  const [{ data: officialCache }, { data: geoCache }] = await Promise.all([
    supabase.from("property_official_data").select("status").eq("property_id", propertyId).maybeSingle(),
    supabase.from("property_geo_analytics").select("status").eq("property_id", propertyId).maybeSingle(),
  ]);
  const officialNeeded = force || !officialCache || officialCache.status === "pending" || officialCache.status === "error";
  const osmNeeded = hasPoint && (force || !geoCache || geoCache.status !== "ready");

  const osmPromise = osmNeeded
    ? syncOsmAnalytics(supabase, { propertyId, lat, lng, radiusMeters: 1000 })
      .then(result => ({ ok: result.ok, message: result.ok ? null : result.error }))
      .catch(err => ({ ok: false, message: err instanceof Error ? err.message : "Error OSM" }))
    : Promise.resolve({ skipped: true as const });

  let municipalityCode = property.municipality_code && /^\d{5}$/.test(property.municipality_code) ? property.municipality_code : null;
  let official: PropertySyncSummary["official"] = { skipped: true };

  if (officialNeeded) {
    const write = async (status: OfficialStatus, values: Record<string, unknown>) => {
      const now = new Date().toISOString();
      const { error: writeError } = await supabase.from("property_official_data").upsert({
        property_id: propertyId, status, synced_at: now, updated_at: now, ...values,
      }, { onConflict: "property_id" });
      if (writeError) throw new Error(`No se pudo guardar la caché oficial: ${writeError.message}`);
      official = { status, message: typeof values.message === "string" ? values.message : null };
    };

    try {
      if (!cromaConfigured()) {
        await write("error", { message: "CROMA_API_KEY no está configurada en el servidor." });
      } else {
        // 1. DIVIPOLA from the municipality name when the admin did not type it.
        if (!municipalityCode && property.municipality) {
          const resolved = await resolveMunicipalityCode(property.municipality, property["ubicación"]).catch(() => null);
          if (resolved) {
            municipalityCode = resolved.code;
            const { error: updateError } = await supabase.from("properties").update({ municipality_code: resolved.code }).eq("id", propertyId);
            if (updateError) console.error("[property-sync] No se pudo guardar el DIVIPOLA:", updateError.message);
          }
        }

        // 2. Municipal indicators (also tell us who manages the cadastre).
        const territorial = municipalityCode ? await fetchTerritorialData(municipalityCode).catch(() => null) : null;
        const manager = territorial?.cadastralStats?.manager ?? null;

        // 3. Parcel lookup.
        const npn = [property.national_cadastral_number, property.cadastral_id]
          .map(value => (value || "").replace(/\D/g, "")).find(value => /^\d{30}$/.test(value)) || null;
        let lookup: CadastralLookup | null = null;
        if (npn) lookup = await lookupCadastralByNumber(npn);
        if ((!lookup || lookup.found !== true) && hasPoint && managerIsIgac(manager)) lookup = await lookupCadastralByPoint(lat, lng);

        const base = {
          municipality_code: municipalityCode,
          municipality: property.municipality,
          department: property["ubicación"],
          cadastral_manager: manager,
          territorial: territorialJson(territorial),
          lookup_method: lookup?.method ?? "none",
          source_checked_at: lookup?.checkedAt ?? null,
          cadastral_number: null, previous_cadastral_number: null, address: null, appraisal: null,
          built_area_m2: null, land_area_m2: null, economic_destination: null, vigencia: null, buildings: [], geometry: null,
        };

        const parcel = lookup?.found === true ? lookup.property : null;
        const parcelMunicipality = text(parcel?.municipality_code);
        if (parcel && municipalityCode && parcelMunicipality && parcelMunicipality !== municipalityCode) {
          await write("error", { ...base, message: `Las coordenadas caen en otro municipio (${text(parcel.municipality) || parcelMunicipality}, ${parcelMunicipality}). Revisa la ubicación del inmueble.` });
        } else if (parcel) {
          const cadastralNumber = (text(parcel.cadastral_number) || "").replace(/\D/g, "");
          await write("verified", {
            ...base,
            municipality_code: municipalityCode || parcelMunicipality,
            municipality: text(parcel.municipality) || property.municipality,
            cadastral_number: /^\d{30}$/.test(cadastralNumber) ? cadastralNumber : null,
            previous_cadastral_number: text(parcel.previous_cadastral_number),
            address: text(parcel.address),
            appraisal: numberOrNull(parcel.appraisal),
            built_area_m2: numberOrNull(parcel.built_area_m2),
            land_area_m2: numberOrNull(parcel.land_area_m2),
            economic_destination: text(parcel.economic_destination),
            vigencia: parcel.vigencia ?? null,
            buildings: Array.isArray(parcel.buildings) ? parcel.buildings : [],
            geometry: parcel.geometry ?? null,
            message: lookup?.method === "coordinates"
              ? "Predio identificado por coordenadas: confirma que corresponde al inmueble antes de usarlo como dato oficial."
              : null,
          });
        } else if (!managerIsIgac(manager) && !npn) {
          await write("manager_not_igac", { ...base, message: `El catastro de este municipio lo administra ${manager}. El IGAC no publica sus predios: registra avalúo, áreas y número predial desde el certificado catastral.` });
        } else if (!npn && !hasPoint) {
          await write("no_identifier", { ...base, message: "Registra el Número Predial Nacional (30 dígitos) o coordenadas válidas." });
        } else {
          await write("not_found", { ...base, message: npn ? "El Número Predial Nacional no aparece en el IGAC." : "No hay un predio IGAC en las coordenadas registradas." });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error consultando fuentes oficiales.";
      console.error("[property-sync]", propertyId, message);
      try { await write("error", { municipality_code: municipalityCode, message }); } catch { /* keep summary */ }
      official = { status: "error", message };
    }
  }

  const osm = await osmPromise;
  return { propertyId, municipalityCode, official, osm };
}
