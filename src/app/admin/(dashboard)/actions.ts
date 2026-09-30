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
  status: "Disponible" | "Vendido" | "Oculto";
  lat: number;
  lng: number;
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
    municipality: data.location_text.split(",")[0]?.trim() || "",
    ["ubicación"]: data.location_text.split(",").slice(1).join(",").trim(),
    status: data.status === "Disponible" || data.status === "Oculto" ? "En Venta" : "Vendido",
    is_published: data.status !== "Oculto",
    lat: data.lat,
    lng: data.lng,
    images: data.images.filter(url => typeof url === "string" && /^https?:\/\//i.test(url)),
    updated_at: new Date().toISOString(),
  };
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
    const { error } = await supabase.from("properties").insert({
      ...dbValues(data), slug,
      features: [], categories: ["Buy"], payment: [], featured: false,
    });
    if (error) throw error;
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
    const { error } = await supabase.from("properties").update(dbValues(data)).eq("id", id);
    if (error) throw error;
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
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    refreshCatalog();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo eliminar el inmueble." };
  }
}
