"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PropertyInput = {
  title: string;
  description: string;
  price: number;
  type: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  location_text: string;
  status: "Disponible" | "En arriendo" | "Vendido" | "Oculto";
  lat: number;
  lng: number;
  municipality: string;
  department: string;
  features: string[];
  categories: ("Buy" | "Rent" | "Projects" | "Commercial")[];
  payment: string[];
  featured: boolean;
  images: string[];
};

type ActionResult = { success: true } | { success: false; error: string };

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
  if (data.bedrooms < 0 || data.bathrooms < 0 || !Number.isInteger(data.bedrooms) || !Number.isInteger(data.bathrooms)) {
    throw new Error("Habitaciones y baños deben ser números enteros iguales o mayores que cero.");
  }
}

function dbValues(data: PropertyInput) {
  validate(data);
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    price: data.price,
    type: data.type,
    area: data.area_sqm,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    location: data.location_text.trim(),
    municipality: data.municipality.trim() || data.location_text.split(",")[0]?.trim() || "",
    ["ubicación"]: data.department.trim() || data.location_text.split(",").slice(1).join(",").trim(),
    status: data.status === "Disponible" || data.status === "Oculto" ? "En Venta" : data.status === "En arriendo" ? "En Arriendo" : "Vendido",
    is_published: data.status !== "Oculto",
    lat: data.lat,
    lng: data.lng,
    images: data.images.filter(url => typeof url === "string" && /^https:\/\//i.test(url)),
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

function slugify(value: string) {
  return value.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `inmueble-${Date.now()}`;
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
    const { data: created, error } = await supabase.from("properties").insert({
      ...dbValues(data), slug,
    }).select("id").single();
    if (error) throw error;
    if (data.featured) {
      const { error: featuredError } = await supabase.rpc("set_featured_property", { target_id: created.id });
      if (featuredError) throw featuredError;
    }
    refreshCatalog();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo crear el inmueble." };
  }
}

export async function updateProperty(id: number, data: PropertyInput): Promise<ActionResult> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    const supabase = await authorizedClient();
    const { data: existing, error: readError } = await supabase.from("properties").select("images").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) throw new Error("El inmueble ya no existe.");
    const { error } = await supabase.from("properties").update(dbValues(data)).eq("id", id);
    if (error) throw error;
    if (data.featured) {
      const { error: featuredError } = await supabase.rpc("set_featured_property", { target_id: id });
      if (featuredError) throw featuredError;
    }
    await removeUnreferencedStorageFiles(supabase, existing.images || [], data.images);
    refreshCatalog();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el inmueble." };
  }
}

export async function deleteProperty(id: number): Promise<ActionResult> {
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("El identificador del inmueble no es válido.");
    const supabase = await authorizedClient();
    const { data: existing, error: readError } = await supabase.from("properties").select("images").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) throw new Error("El inmueble ya no existe.");
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    await removeUnreferencedStorageFiles(supabase, existing.images || [], []);
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
