import type { Property } from "@/data/properties";

export type PropertyDatabaseRow = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price: number | string;
  location: string;
  municipality: string;
  "ubicación": string;
  lat: number | string;
  lng: number | string;
  bedrooms: number;
  bathrooms: number;
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
};

export function propertyFromDatabase(row: PropertyDatabaseRow): Property {
  const gallery = (row.images || []).filter((image): image is string => typeof image === "string" && image.length > 0);
  const status: Property["status"] = row.status.toLowerCase().includes("arriendo") ? "En arriendo" : "En venta";
  const validCategories = (row.categories || []).filter((category): category is Property["categories"][number] =>
    ["Buy", "Rent", "Projects", "Commercial"].includes(category),
  );
  const categories: Property["categories"] = validCategories.length ? validCategories : status === "En arriendo" ? ["Rent"] : ["Buy"];
  const [fallbackMunicipality, fallbackDepartment = ""] = row.location.split(",").map(part => part.trim());

  return {
    id: row.slug,
    slug: row.slug,
    name: row.title,
    location: row.location,
    municipality: row.municipality || fallbackMunicipality,
    department: row["ubicación"] || fallbackDepartment,
    price: Number(row.price),
    area: Number(row.area),
    type: row.type,
    status,
    categories,
    bedrooms: Number(row.bedrooms || 0),
    bathrooms: Number(row.bathrooms || 0),
    image: gallery[0] || "",
    gallery,
    description: row.description || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    featured: Boolean(row.featured),
    amenities: row.features || [],
    payment: row.payment || [],
  };
}

export function propertyToDatabase(property: Property, isPublished: boolean) {
  return {
    title: property.name,
    slug: property.slug,
    description: property.description,
    price: property.price,
    location: property.location,
    municipality: property.municipality,
    ["ubicación"]: property.department,
    category_id: property.type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    lat: property.lat,
    lng: property.lng,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area: property.area,
    type: property.type,
    status: property.status === "En arriendo" ? "En Arriendo" : "En Venta",
    images: property.gallery,
    features: property.amenities,
    categories: property.categories,
    payment: property.payment,
    featured: Boolean(property.featured),
    is_published: isPublished,
    updated_at: new Date().toISOString(),
  };
}
