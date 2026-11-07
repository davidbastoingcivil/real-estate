import type { Property } from "@/data/properties";

export type PropertyDatabaseRow = {
  id: number;
  property_code?: string | null;
  title: string;
  slug: string;
  description: string | null;
  price: number | string;
  periodicity?: string | null;
  location: string;
  municipality: string;
  "ubicación": string;
  lat: number | string;
  lng: number | string;
  bedrooms: number;
  bathrooms: number;
  garage_spaces?: number | null;
  area: number | string;
  type: Property["type"];
  status: string;
  images: string[] | null;
  features: string[] | null;
  categories: string[] | null;
  payment: string[] | null;
  featured: boolean;
  is_published: boolean;
  updated_at: string;
  category_id: string;
  audio_tours?: Property["audioTours"] | null;
  video_presentations?: Property["videoPresentations"] | null;
  dossier?: Property["dossier"] | null;
};

export function propertyFromDatabase(row: PropertyDatabaseRow): Property {
  const gallery = (row.images || []).filter((image): image is string => typeof image === "string" && image.length > 0);
  const cover = gallery.find(image => !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(image)) || "";
  const status: Property["status"] = row.status.toLowerCase().includes("arriendo")
    ? "En arriendo"
    : row.status.toLowerCase().includes("vendido") ? "Vendido" : "En venta";
  const validCategories = (row.categories || []).filter((category): category is Property["categories"][number] =>
    ["Buy", "Rent", "Projects", "Commercial"].includes(category),
  );
  const categories: Property["categories"] = validCategories.length ? validCategories : status === "En arriendo" ? ["Rent"] : ["Buy"];
  const [fallbackMunicipality, fallbackDepartment = ""] = row.location.split(",").map(part => part.trim());

  return {
    id: row.slug,
    databaseId: row.id,
    code: row.property_code || `DBRE-${String(row.id).padStart(5, "0")}`,
    slug: row.slug,
    name: row.title,
    location: row.location,
    municipality: row.municipality || fallbackMunicipality,
    department: row["ubicación"] || fallbackDepartment,
    price: Number(row.price),
    periodicity: row.periodicity === "Mensual" ? "Mensual" : "Único",
    area: Number(row.area),
    type: row.type,
    status,
    categories,
    bedrooms: Number(row.bedrooms || 0),
    bathrooms: Number(row.bathrooms || 0),
    garages: Number(row.garage_spaces || 0),
    image: cover,
    gallery,
    description: row.description || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    featured: Boolean(row.featured),
    amenities: row.features || [],
    payment: row.payment || [],
    audioTours: Array.isArray(row.audio_tours) ? row.audio_tours : [],
    videoPresentations: Array.isArray(row.video_presentations) ? row.video_presentations : [],
    dossier: row.dossier || undefined,
  };
}

export function propertyToDatabase(property: Property, isPublished: boolean) {
  return {
    title: property.name,
    slug: property.slug,
    description: property.description,
    price: property.price,
    property_code: property.code || null,
    periodicity: property.periodicity || "Único",
    location: property.location,
    municipality: property.municipality,
    ["ubicación"]: property.department,
    category_id: property.type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    lat: property.lat,
    lng: property.lng,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    garage_spaces: property.garages || 0,
    area: property.area,
    type: property.type,
    status: property.status === "En arriendo" ? "En Arriendo" : property.status === "Vendido" ? "Vendido" : "En Venta",
    images: property.gallery,
    features: property.amenities,
    categories: property.categories,
    payment: property.payment,
    audio_tours: property.audioTours || [],
    video_presentations: property.videoPresentations || [],
    dossier: property.dossier || {},
    featured: Boolean(property.featured),
    is_published: isPublished,
    updated_at: new Date().toISOString(),
  };
}
