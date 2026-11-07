export type AudioTour = { title: string; url: string; duration?: string };
export type VideoPresentation = { title: string; url: string; thumbnail?: string };
export type DossierSection = { title: string; description?: string; items?: string[] };
export type ProjectDossier = { developer?: string; tagline?: string; description?: string; brochurePrice?: number; travelTime?: string; sections?: DossierSection[] };
export type Property = {
  id: string; databaseId?: number; code?: string; slug: string; name: string; location: string; municipality: string; department: string;
  price: number; periodicity?: "Único" | "Mensual"; area: number; type: "Casa" | "Lote" | "Apartamento" | "Villa" | "Comercial"; status: "En venta" | "En arriendo" | "Vendido"; categories: ("Buy" | "Rent" | "Projects" | "Commercial")[]; bedrooms: number; bathrooms: number; garages?: number;
  image: string; gallery: string[]; description: string; lat: number; lng: number; featured?: boolean;
  amenities: string[]; payment: string[]; audioTours?: AudioTour[]; videoPresentations?: VideoPresentation[]; dossier?: ProjectDossier;
};

// Stable Spanish data contract for listings, integrations and project documents.
export type CanonicalProperty = {
  id: string; codigo: string; slug: string; operacion: "Comprar" | "Arrendar"; tipo: Property["type"]; titulo: string;
  ciudad: string; zona: string; precio: number; periodicidad: "Único" | "Mensual"; area_m2: number; habitaciones: number;
  banos: number; garajes: number; imagenes: string[]; descripcion: string; asesor: string;
  coordenadas: { lat: number; lng: number }; estado: Property["status"]; destacado: boolean;
};

export function toCanonicalProperty(property: Property, advisor = "David Basto"): CanonicalProperty {
  return {
    id: property.id, codigo: property.code || property.id, slug: property.slug,
    operacion: property.status === "En arriendo" ? "Arrendar" : "Comprar", tipo: property.type, titulo: property.name,
    ciudad: property.municipality, zona: property.location, precio: property.price,
    periodicidad: property.periodicity || (property.status === "En arriendo" ? "Mensual" : "Único"), area_m2: property.area,
    habitaciones: property.bedrooms, banos: property.bathrooms, garajes: property.garages || 0,
    imagenes: property.gallery?.length ? property.gallery : property.image ? [property.image] : [],
    descripcion: property.description, asesor: advisor, coordenadas: { lat: property.lat, lng: property.lng },
    estado: property.status, destacado: Boolean(property.featured),
  };
}

const bambuGallery = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85"
];

export const properties: Property[] = [
  { id: "bambu", code: "DBRE-BAMBU", slug: "condominio-bambu", name: "Condominio Bambú", location: "Carmen de Apicalá, Tolima", municipality: "Carmen de Apicalá", department: "Tolima", price: 390000000, periodicity: "Único", area: 144, type: "Casa", status: "En venta", categories: ["Buy", "Projects"], bedrooms: 3, bathrooms: 3, garages: 1, image: bambuGallery[0], gallery: bambuGallery, description: "Un refugio contemporáneo donde la arquitectura serena y la naturaleza se encuentran. Vive el clima cálido de Tolima en una casa moderna con terraza y espacios pensados para disfrutar cada día.", lat: 4.1472, lng: -74.7201, featured: true, amenities: ["144 m² + terraza", "Entorno natural", "Clima cálido todo el año", "Zona de alta valorización", "Conjunto privado", "Diseño contemporáneo"], payment: ["30% de cuota inicial", "Pagos mensuales según certificación de avance de obra", "Esquema transparente y seguro"], dossier: { developer: "RB Construction", tagline: "Tu nuevo hogar o inversión en Carmen de Apicalá", description: "Vivienda campestre lista para habitar o arrendar en un entorno natural, privado y de clima cálido.", brochurePrice: 390000000, travelTime: "2 h 30 desde Bogotá", sections: [{ title: "Nivel 1 · Primer piso", description: "Espacios amplios y luminosos que conectan sala, comedor y cocina con un jardín interior.", items: ["Ingreso amplio", "Sala con zona de televisión", "Jardín interior", "Comedor para seis personas", "Cocina", "Parqueadero privado para un vehículo", "Baño social y zona de lavandería"] }, { title: "Nivel 2 · Segundo piso", description: "Zona privada de descanso con tres habitaciones y balcón.", items: ["Tres habitaciones con ventilador de techo", "Dos baños completos con ducha", "Balcón con zona de estar", "Doble altura con cubierta de vidrio y vegetación"] }, { title: "Terraza social", description: "Un espacio al aire libre para descansar y recibir.", items: ["Jacuzzi con deck de madera", "Zona de asoleadoras y sombrilla", "Hamaca y rincón de lectura", "Sala exterior y comedor", "Zona de parrilla y barra"] }, { title: "Servicios y acabados", items: ["Tanque subterráneo de reserva de agua de 2.000 L", "Tanque cubierto de reserva de agua de 1.000 L", "Ducha con vidrio y revestimiento decorativo", "Mesón en piedra y espejo con iluminación", "Grifería dorada y nichos iluminados"] }] } },
  { id: "sabana", slug: "reserva-de-la-sabana", name: "Reserva de la Sabana", location: "La Calera, Cundinamarca", municipality: "La Calera", department: "Cundinamarca", price: 485000000, area: 186, type: "Casa", status: "En venta", categories: ["Buy"], bedrooms: 4, bathrooms: 3, image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80", gallery: bambuGallery, description: "Arquitectura abierta, vistas verdes y espacios para compartir a minutos de Bogotá.", lat: 4.7203, lng: -73.9697, amenities: ["186 m² construidos", "Vista a la montaña", "Conjunto cerrado", "Terraza privada"], payment: ["30% de cuota inicial", "Plan de pagos flexible", "Acompañamiento personalizado"] },
  { id: "palma", slug: "casas-del-palmar", name: "Casas del Palmar", location: "Ricaurte, Cundinamarca", municipality: "Ricaurte", department: "Cundinamarca", price: 298000000, area: 128, type: "Casa", status: "En venta", categories: ["Buy"], bedrooms: 3, bathrooms: 2, image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80", gallery: bambuGallery, description: "Una casa luminosa para escapar de la rutina y disfrutar el sol de Ricaurte.", lat: 4.2808, lng: -74.7732, amenities: ["128 m² construidos", "Piscina comunal", "Clima cálido", "A 10 minutos de Girardot"], payment: ["30% de cuota inicial", "Cuotas durante construcción", "Asesoría de principio a fin"] }
];

export const formatCOP = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
