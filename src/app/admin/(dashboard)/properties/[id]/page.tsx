import { notFound } from "next/navigation";
import PropertyForm, { type PropertyFormData } from "@/components/admin/PropertyForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: propertyTypes }] = await Promise.all([
    supabase.from("properties").select('id,title,description,price,type,area,bedrooms,bathrooms,location,status,is_published,lat,lng,cadastral_id,images,municipality,"ubicación",features,categories,payment,featured')
      .eq("id", id).maybeSingle(),
    supabase.from("property_types").select("id,label").order("sort_order"),
  ]);
  if (error || !data) notFound();
  const lowerStatus = data.status.toLocaleLowerCase("es");
  const status: PropertyFormData["status"] = !data.is_published ? "Oculto" : lowerStatus.includes("vendido") ? "Vendido" : lowerStatus.includes("arriendo") ? "En arriendo" : "Disponible";
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
    cadastral_id: data.cadastral_id || "",
    images: (data.images || []) as string[],
    municipality: data.municipality || "",
    department: data["ubicación"] || "",
    features: (data.features || []) as string[],
    categories: (data.categories || ["Buy"]) as PropertyFormData["categories"],
    payment: (data.payment || []) as string[],
    featured: Boolean(data.featured),
  };
  return <PropertyForm initialData={initialData} propertyTypes={propertyTypes || []}/>;
}
