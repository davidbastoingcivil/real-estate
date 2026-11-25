"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncPropertyIntegrations, type PropertySyncSummary } from "@/lib/integrations/propertySync";
import { isBogotaChip, parseBogotaCadastralCsv, type BogotaParcel } from "@/lib/integrations/bogotaCadastre";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AudioTour, ProjectDossier, VideoPresentation } from "@/data/properties";

export type PropertyInput = {
  title: string;
  description: string;
  price: number;
  property_code: string;
  periodicity: "Único" | "Mensual";
  type: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  garage_spaces: number;
  location_text: string;
  status: "Disponible" | "En arriendo" | "Vendido" | "Oculto";
  lat: number;
  lng: number;
  cadastral_id: string;
  chip: string;
  national_cadastral_number: string;
  real_estate_registration: string;
  stratum: number | null;
  cadastral_appraisal: number | null;
  official_lot_area: number | null;
  official_built_area: number | null;
  deposits: number;
  municipality: string;
  municipality_code: string;
  department: string;
  features: string[];
  categories: ("Buy" | "Rent" | "Projects" | "Commercial")[];
  payment: string[];
  featured: boolean;
  images: string[];
  audio_tours: AudioTour[];
  video_presentations: VideoPresentation[];
  dossier: ProjectDossier;
};

type ActionResult = { success: true; warning?: string; propertyId?: number } | { success: false; error: string };

const extendedPropertyColumns = [
  "property_code", "periodicity", "garage_spaces", "municipality_code", "chip", "national_cadastral_number",
  "real_estate_registration", "stratum", "cadastral_appraisal", "official_lot_area", "official_built_area",
  "deposits", "audio_tours", "video_presentations", "dossier",
] as const;

function isMissingMigrationColumn(error: { code?: string | null; message?: string | null }) {
  return error.code === "42703" || error.code === "PGRST204"
    || /schema cache|column .* does not exist|could not find .* column/i.test(error.message || "");
}

function legacyPropertyValues(values: ReturnType<typeof dbValues>) {
  const legacy: Record<string, unknown> = { ...values };
  for (const column of extendedPropertyColumns) delete legacy[column];
  return legacy;
}

const migrationWarning = "Se guardaron los datos básicos. Aún faltan migraciones de Supabase: los campos catastrales ampliados, la ficha del proyecto y los enlaces multimedia no se guardaron. Ejecuta las migraciones pendientes para habilitarlos.";

async function authorizedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Inicia sesión para administrar los inmuebles.");
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminError || !admin) throw new Error("Tu cuenta no tiene permisos de administrador.");
  return supabase;
}

function validate(data: PropertyInput) {
  if (!data.title.trim() || !data.type.trim() || !data.location_text.trim()) {
    throw new Error("Completa el nombre, el tipo y la ubicación del inmueble.");
  }
  if (!Number.isFinite(data.price) || data.price < 0 || !Number.isFinite(data.area_sqm) || data.area_sqm < 0) {
    throw new Error("El precio y el área deben ser valores válidos.");
  }
  if (![data.bedrooms, data.bathrooms, data.lat, data.lng].every(Number.isFinite)) {
    throw new Error("Revisa las características y coordenadas ingresadas.");
  }
  if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
    throw new Error("La latitud debe estar entre -90 y 90 y la longitud entre -180 y 180.");
  }
  if (data.cadastral_id.length > 50 || /[^a-zA-Z0-9 .-]/.test(data.cadastral_id)) {
    throw new Error("La cédula catastral debe tener máximo 50 caracteres alfanuméricos, puntos o guiones.");
  }
  const chip = data.chip.trim().toUpperCase();
  if (chip && !/^[A-Z]{3}\d{4}[A-Z]{4}$/.test(chip)) {
    throw new Error("El CHIP de Bogotá debe tener 11 caracteres con el formato AAA0000AAAA.");
  }
  if (data.national_cadastral_number && !/^\d{30}$/.test(data.national_cadastral_number)) throw new Error("El Número Predial Nacional debe tener exactamente 30 dígitos.");
  if (data.real_estate_registration.length > 40) throw new Error("La matrícula inmobiliaria debe tener máximo 40 caracteres.");
  if (data.municipality_code && !/^\d{5}$/.test(data.municipality_code)) throw new Error("El código DIVIPOLA debe contener exactamente cinco dígitos.");
  if (data.national_cadastral_number && data.municipality_code
      && data.national_cadastral_number.slice(0, 5) !== data.municipality_code) {
    throw new Error("Los primeros cinco dígitos del Número Predial Nacional deben coincidir con el código DIVIPOLA del municipio.");
  }
  if (data.stratum !== null && (!Number.isInteger(data.stratum) || data.stratum < 0 || data.stratum > 6)) throw new Error("El estrato debe estar entre 0 y 6.");
  if ([data.cadastral_appraisal, data.official_lot_area, data.official_built_area].some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error("Revisa el avalúo y las áreas oficiales registradas.");
  if (data.bedrooms < 0 || data.bathrooms < 0 || data.garage_spaces < 0 || !Number.isInteger(data.bedrooms) || !Number.isInteger(data.bathrooms) || !Number.isInteger(data.garage_spaces)) {
    throw new Error("Habitaciones y baños deben ser números enteros iguales o mayores que cero.");
  }
  if (data.property_code.length > 40 || data.audio_tours.length > 20 || data.video_presentations.length > 20) {
    throw new Error("Revisa el código del inmueble y el número de archivos multimedia.");
  }
}

function dbValues(data: PropertyInput) {
  validate(data);
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    price: data.price,
    property_code: data.property_code.trim() || null,
    periodicity: data.periodicity,
    type: data.type,
    area: data.area_sqm,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    garage_spaces: data.garage_spaces,
    location: data.location_text.trim(),
    municipality: data.municipality.trim() || data.location_text.split(",")[0]?.trim() || "",
    municipality_code: data.municipality_code.trim() || null,
    ["ubicación"]: data.department.trim() || data.location_text.split(",").slice(1).join(",").trim(),
    status: data.status === "Disponible" || data.status === "Oculto" ? "En Venta" : data.status === "En arriendo" ? "En Arriendo" : "Vendido",
    is_published: data.status !== "Oculto",
    lat: data.lat,
    lng: data.lng,
    cadastral_id: data.cadastral_id.trim() || null,
    chip: data.chip.trim() || null,
    national_cadastral_number: data.national_cadastral_number || null,
    real_estate_registration: data.real_estate_registration.trim() || null,
    stratum: data.stratum,
    cadastral_appraisal: data.cadastral_appraisal,
    official_lot_area: data.official_lot_area,
    official_built_area: data.official_built_area,
    deposits: data.deposits,
    images: data.images.filter(url => typeof url === "string" && /^https:\/\//i.test(url)),
    audio_tours: data.audio_tours.filter(item => /^https:\/\//i.test(item.url)),
    video_presentations: data.video_presentations.filter(item => /^https:\/\//i.test(item.url)),
    dossier: data.dossier,
    features: data.features.map(item => item.trim()).filter(Boolean),
    categories: data.categories,
    payment: data.payment.map(item => item.trim()).filter(Boolean),
    // Featured selection is applied through the database RPC to preserve the single-featured invariant.
    featured: false,
    updated_at: new Date().toISOString(),
  };
}

function storagePath(url: string) {
  const marker = "/storage/v1/object/public/property-images/";
  const position = url.indexOf(marker);
  if (position < 0) return null;
  try { return decodeURIComponent(url.slice(position + marker.length)); } catch { return null; }
}

async function removeUnreferencedStorageFiles(supabase: Awaited<ReturnType<typeof authorizedClient>>, oldUrls: string[], newUrls: string[]) {
  const retained = new Set(newUrls);
  const paths = [...new Set(oldUrls.filter(url => !retained.has(url)).map(storagePath).filter((path): path is string => Boolean(path)))];
  if (!paths.length) return;
  const { error } = await supabase.storage.from("property-images").remove(paths);
  if (error) console.error("No se pudieron limpiar algunos archivos eliminados del inmueble:", error.message);
}

function mediaUrls(items: Array<{ url?: string }> | null | undefined) {
  return (items || []).map(item => item.url).filter((url): url is string => typeof url === "string");
}

function slugify(value: string) {
  return value.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `inmueble-${Date.now()}`;
}

/**
 * Pull data after the response is sent, so saving stays fast. Croma (IGAC/DANE) is
 * only consulted for a newly registered property (`includeOfficial: true`); edits and
 * imports refresh OpenStreetMap only.
 */
function scheduleIntegrationSync(supabase: Awaited<ReturnType<typeof authorizedClient>>, propertyId: number, { includeOfficial }: { includeOfficial: boolean }) {
  after(async () => {
    try {
      const summary = await syncPropertyIntegrations(supabase, propertyId, { includeOfficial });
      console.info("[property-sync]", JSON.stringify(summary));
      revalidatePath("/admin");
    } catch (error) {
      console.error("[property-sync] falló", propertyId, error instanceof Error ? error.message : error);
    }
  });
}

function refreshCatalog() {
  revalidatePath("/admin");
  revalidatePath("/buscar");
  revalidatePath("/");
}

export async function createProperty(data: PropertyInput): Promise<ActionResult> {
  try {
    const supabase = await authorizedClient();
    const baseSlug = slugify(data.title);
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const { data: existing, error } = await supabase.from("properties").select("id").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!existing) break;
      slug = `${baseSlug}-${suffix++}`;
    }
    const values = { ...dbValues(data), slug };
    let { data: created, error } = await supabase.from("properties").insert(values).select("id").single();
    let migrationPending = false;
    if (error && isMissingMigrationColumn(error)) {
      const legacy = { ...legacyPropertyValues(values as ReturnType<typeof dbValues>), slug };
      const fallback = await supabase.from("properties").insert(legacy).select("id").single();
      created = fallback.data;
      error = fallback.error;
      migrationPending = !error;
    }
    if (error) throw error;
    if (!created) throw new Error("Supabase no devolvió el inmueble creado.");
    if (data.featured) {
      const { error: featuredError } = await supabase.rpc("set_featured_property", { target_id: created.id });
      if (featuredError) throw featuredError;
    }
    scheduleIntegrationSync(supabase, Number(created.id), { includeOfficial: true });
    refreshCatalog();
    return migrationPending ? { success: true, warning: migrationWarning, propertyId: Number(created.id) } : { success: true, propertyId: Number(created.id) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear el inmueble." };
  }
}

export async function updateProperty(id: number, data: PropertyInput): Promise<ActionResult> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    const supabase = await authorizedClient();
    const { data: existing, error: readError } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) throw new Error("El inmueble ya no existe.");
    const values = dbValues(data);
    let { error } = await supabase.from("properties").update(values).eq("id", id);
    let migrationPending = false;
    if (error && isMissingMigrationColumn(error)) {
      const fallback = await supabase.from("properties").update(legacyPropertyValues(values)).eq("id", id);
      error = fallback.error;
      migrationPending = !error;
    }
    if (error) throw error;
    if (data.featured) {
      const { error: featuredError } = await supabase.rpc("set_featured_property", { target_id: id });
      if (featuredError) throw featuredError;
    }
    const previousFiles = migrationPending ? (existing.images || []) : [...(existing.images || []), ...mediaUrls(existing.audio_tours), ...mediaUrls(existing.video_presentations)];
    const retainedFiles = migrationPending ? data.images : [...data.images, ...mediaUrls(data.audio_tours), ...mediaUrls(data.video_presentations)];
    await removeUnreferencedStorageFiles(supabase, previousFiles, retainedFiles);
    scheduleIntegrationSync(supabase, id, { includeOfficial: false });
    refreshCatalog();
    return migrationPending ? { success: true, warning: migrationWarning, propertyId: id } : { success: true, propertyId: id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el inmueble." };
  }
}

/** Explicit re-sync from the admin panel: the only path besides creation that queries Croma (IGAC/DANE). */
export async function resyncPropertyIntegrations(id: number): Promise<{ success: true; summary: PropertySyncSummary } | { success: false; error: string }> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    const supabase = await authorizedClient();
    const summary = await syncPropertyIntegrations(supabase, id, { force: true });
    revalidatePath("/admin");
    revalidatePath(`/admin/properties/${id}`);
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo sincronizar el inmueble." };
  }
}

/**
 * Import a Catastro Bogotá (UAECD / IDECA) parcel export for one property.
 * Matches the file to the property by CHIP, NPN or cédula catastral, fills the
 * cadastral fields of the record and stores the parcel as verified official data.
 */
export async function importBogotaCadastralCsv(id: number, csvText: string): Promise<{ success: true; parcel: BogotaParcel } | { success: false; error: string }> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    if (typeof csvText !== "string" || !csvText.trim()) throw new Error("El archivo está vacío.");
    if (csvText.length > 5_000_000) throw new Error("El archivo supera 5 MB. Descarga solo el predio del inmueble.");
    const supabase = await authorizedClient();
    const { data: property, error } = await supabase.from("properties")
      .select("id,chip,cadastral_id,national_cadastral_number,municipality,municipality_code")
      .eq("id", id).maybeSingle();
    if (error) throw error;
    if (!property) throw new Error("El inmueble ya no existe.");
    if (property.municipality_code && property.municipality_code !== "11001") {
      throw new Error(`Este inmueble está registrado con DIVIPOLA ${property.municipality_code}; el archivo de Catastro Bogotá solo aplica a Bogotá (11001).`);
    }

    const parcels = parseBogotaCadastralCsv(csvText);
    const clean = (value: string | null | undefined) => (value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const match = parcels.find(parcel =>
      (property.chip && parcel.chip === clean(property.chip))
      || (property.national_cadastral_number && parcel.nationalCadastralNumber === clean(property.national_cadastral_number))
      || (property.cadastral_id && parcel.cadastralId && clean(parcel.cadastralId) === clean(property.cadastral_id)))
      || (parcels.length === 1 ? parcels[0] : null);
    if (!match) {
      const options = parcels.slice(0, 5).map(parcel => `${parcel.chip} (${parcel.officialAddress || "sin dirección"})`).join(", ");
      throw new Error(`El archivo tiene ${parcels.length} predios y ninguno coincide con el CHIP o número predial de la ficha. Registra el CHIP correcto y vuelve a importar. Predios encontrados: ${options}${parcels.length > 5 ? "…" : ""}`);
    }
    if (!isBogotaChip(match.chip)) throw new Error(`El CHIP ${match.chip} no tiene el formato de Catastro Bogotá (AAA0000AAAA).`);
    if (match.nationalCadastralNumber && !match.nationalCadastralNumber.startsWith("11001")) {
      throw new Error("El Número Predial Nacional del archivo no corresponde a Bogotá (prefijo 11001).");
    }

    // 1. Cadastral fields of the listing (the trigger marks the cache as pending).
    const { error: updateError } = await supabase.from("properties").update({
      chip: match.chip,
      cadastral_id: match.cadastralId,
      national_cadastral_number: match.nationalCadastralNumber,
      official_lot_area: match.lotAreaM2,
      official_built_area: match.builtAreaM2,
      municipality_code: "11001",
      ...(property.municipality ? {} : { municipality: "Bogotá D.C." }),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw updateError;

    // 2. Official parcel data. Municipal indicators already stored for the
    //    property are kept; Croma is not queried here.
    const now = new Date().toISOString();
    const { error: cacheError } = await supabase.from("property_official_data").upsert({
      property_id: id,
      status: "verified",
      source: "catastro_bogota",
      lookup_method: "import",
      municipality_code: "11001",
      municipality: "Bogotá D.C.",
      department: "Bogotá D.C.",
      cadastral_manager: "Unidad Administrativa Especial de Catastro Distrital Bogotá - UAECD",
      cadastral_number: match.nationalCadastralNumber,
      previous_cadastral_number: match.cadastralId,
      address: [match.officialAddress, match.neighbourhood].filter(Boolean).join(" · ") || null,
      appraisal: null,
      built_area_m2: match.builtAreaM2,
      land_area_m2: match.lotAreaM2,
      economic_destination: match.economicDestination,
      vigencia: { status: match.updateYear ? "Actualizado" : null, update_year: match.updateYear, formation_year: match.formationYear, zone: "urban" },
      buildings: match.uses.map(use => ({ use: use.use, area_m2: use.areaM2, floors: null, bathrooms: null })),
      geometry: null,
      details: match,
      source_checked_at: now,
      message: "Datos importados desde el archivo de Catastro Bogotá (UAECD / IDECA).",
      synced_at: now,
      updated_at: now,
    }, { onConflict: "property_id" });
    if (cacheError) throw cacheError;

    scheduleIntegrationSync(supabase, id, { includeOfficial: false });
    revalidatePath("/admin");
    revalidatePath(`/admin/properties/${id}`);
    return { success: true, parcel: match };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo importar el archivo de Catastro Bogotá." };
  }
}

export async function deleteProperty(id: number): Promise<ActionResult> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    const supabase = await authorizedClient();
    const { data: existing, error: readError } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) throw new Error("El inmueble ya no existe.");
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    await removeUnreferencedStorageFiles(supabase, [...(existing.images || []), ...mediaUrls(existing.audio_tours), ...mediaUrls(existing.video_presentations)], []);
    refreshCatalog();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo eliminar el inmueble." };
  }
}

export async function createPropertyType(label: string): Promise<{ success: true; id: string; label: string } | { success: false; error: string }> {
  try {
    const supabase = await authorizedClient();
    const normalized = label.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 50) throw new Error("El tipo debe tener entre 2 y 50 caracteres.");
    const id = slugify(normalized);
    const { error } = await supabase.from("property_types").insert({ id, label: normalized, description: "", sort_order: 99 });
    if (error?.code === "23505") throw new Error("Ya existe un tipo de inmueble con ese nombre.");
    if (error) throw error;
    revalidatePath("/admin/properties/new");
    revalidatePath("/admin");
    return { success: true, id, label: normalized };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo agregar el tipo." };
  }
}
