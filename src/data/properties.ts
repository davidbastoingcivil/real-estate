export type Property = {
  id: string; slug: string; name: string; location: string; municipality: string; department: string;
  price: number; area: number; type: "Casa" | "Lote" | "Apartamento" | "Villa" | "Comercial"; status: "En venta" | "En arriendo" | "Vendido"; categories: ("Buy" | "Rent" | "Projects" | "Commercial")[]; bedrooms: number; bathrooms: number;
  image: string; gallery: string[]; description: string; lat: number; lng: number; featured?: boolean;
  amenities: string[]; payment: string[];
};

const bambuGallery = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85"
];

export const properties: Property[] = [
  { id: "bambu", slug: "condominio-bambu", name: "Condominio Bambú", location: "Carmen de Apicalá, Tolima", municipality: "Carmen de Apicalá", department: "Tolima", price: 340000000, area: 144, type: "Casa", status: "En venta", categories: ["Buy", "Projects"], bedrooms: 3, bathrooms: 3, image: bambuGallery[0], gallery: bambuGallery, description: "Un refugio contemporáneo donde la arquitectura serena y la naturaleza se encuentran. Vive el clima cálido de Tolima en una casa moderna con terraza y espacios pensados para disfrutar cada día.", lat: 4.1472, lng: -74.7201, featured: true, amenities: ["144 m² + terraza", "Entorno natural", "Clima cálido todo el año", "Zona de alta valorización", "Conjunto privado", "Diseño contemporáneo"], payment: ["30% de cuota inicial", "Pagos mensuales según certificación de avance de obra", "Esquema transparente y seguro"] },
  { id: "sabana", slug: "reserva-de-la-sabana", name: "Reserva de la Sabana", location: "La Calera, Cundinamarca", municipality: "La Calera", department: "Cundinamarca", price: 485000000, area: 186, type: "Casa", status: "En venta", categories: ["Buy"], bedrooms: 4, bathrooms: 3, image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80", gallery: bambuGallery, description: "Arquitectura abierta, vistas verdes y espacios para compartir a minutos de Bogotá.", lat: 4.7203, lng: -73.9697, amenities: ["186 m² construidos", "Vista a la montaña", "Conjunto cerrado", "Terraza privada"], payment: ["30% de cuota inicial", "Plan de pagos flexible", "Acompañamiento personalizado"] },
  { id: "palma", slug: "casas-del-palmar", name: "Casas del Palmar", location: "Ricaurte, Cundinamarca", municipality: "Ricaurte", department: "Cundinamarca", price: 298000000, area: 128, type: "Casa", status: "En venta", categories: ["Buy"], bedrooms: 3, bathrooms: 2, image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80", gallery: bambuGallery, description: "Una casa luminosa para escapar de la rutina y disfrutar el sol de Ricaurte.", lat: 4.2808, lng: -74.7732, amenities: ["128 m² construidos", "Piscina comunal", "Clima cálido", "A 10 minutos de Girardot"], payment: ["30% de cuota inicial", "Cuotas durante construcción", "Asesoría de principio a fin"] }
];

export const formatCOP = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
