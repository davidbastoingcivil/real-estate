import { notFound } from "next/navigation";
import PropertyForm, { type PropertyFormData } from "@/components/admin/PropertyForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("properties").select("id,title,description,price,type,area,bedrooms,bathrooms,location,status,is_published,lat,lng")
    .eq("id", id).maybeSingle();
  if (error || !data) notFound();
  const status: PropertyFormData["status"] = !data.is_published ? "Oculto" : data.status.toLocaleLowerCase("es").includes("vendido") ? "Vendido" : "Disponible";
  const initialData: PropertyFormData = {
    id: data.id,
    title: data.title,
    description: data.description || "",
    price: Number(data.price),
    type: data.type,
    area_sqm: Number(data.area),
    bedrooms: Number(data.bedrooms || 0),
    bathrooms: Number(data.bathrooms || 0),
    location_text: data.location,
    status,
    lat: Number(data.lat || 0),
    lng: Number(data.lng || 0),
  };
  return <PropertyForm initialData={initialData}/>;
}
