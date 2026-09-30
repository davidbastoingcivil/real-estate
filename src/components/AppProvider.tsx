"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { properties, type Property } from "@/data/properties";
import { getSupabaseClient } from "@/lib/supabase/client";
import { propertyFromDatabase, type PropertyDatabaseRow } from "@/lib/supabase/properties";

export type BrandSettings = {
  brandName: string; brandSubtitle: string; brandMark: string; heroTitle: string; heroAccent: string;
  heroDescription: string; heroImage: string; advisorImage: string; siteDescription: string; contactName: string; contactRole: string;
  phone: string; whatsappPhone: string; colors: { forest: string; gold: string; ink: string; paper: string };
};
export const defaultBrandSettings: BrandSettings = {
  brandName: "David Basto", brandSubtitle: "Real Estate", brandMark: "DB",
  heroTitle: "El lugar donde", heroAccent: "todo comienza.", heroDescription: "Hogares con sentido. Inversiones con futuro.\nEncuentra tu próximo capítulo.", heroImage: "", advisorImage: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1100&q=85", siteDescription: "Encuentra tu próximo hogar o inversión inmobiliaria en Colombia con la asesoría de David Basto.",
  contactName: "David Basto", contactRole: "Ing. Civil · Asesor inmobiliario", phone: "+57 312 537 2457", whatsappPhone: "573125372457",
  colors: { forest: "#10251b", gold: "#b99a5d", ink: "#171a17", paper: "#f8f7f3" },
};
type SearchFilters = { query: string; category: string; type: string; minPrice: number; maxPrice: number; bedrooms: number; bathrooms: number; minArea: number };
type AppContextValue = { filters: SearchFilters; setFilters: (next: Partial<SearchFilters>) => void; visibleProperties: Property[]; allProperties: Property[]; contentLoaded: boolean; favorites: string[]; toggleFavorite: (id: string) => void; settings: BrandSettings; reloadContent: () => Promise<void>; setSettings: (settings: BrandSettings) => void };
const defaults: SearchFilters = { query: "", category: "Todas", type: "Todos", minPrice: 0, maxPrice: 1500000000, bedrooms: 0, bathrooms: 0, minArea: 0 };
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, update] = useState(defaults);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [allProperties, setAllProperties] = useState(properties);
  const [settings, setSettings] = useState(defaultBrandSettings);
  const [clientReady, setClientReady] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  useEffect(() => { try { setFavorites(JSON.parse(localStorage.getItem("dbre-favorites") || "[]")); } catch { setFavorites([]); } setClientReady(true); }, []);
  const setFilters = (next: Partial<SearchFilters>) => update(current => ({ ...current, ...next }));
  const toggleFavorite = (id: string) => setFavorites(current => { const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]; localStorage.setItem("dbre-favorites", JSON.stringify(next)); return next; });
  const reloadContent = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setContentLoaded(true); return; }
    try {
      const [listingsResult, settingsResult] = await Promise.all([
        supabase.from("properties").select("*").eq("is_published", true).order("updated_at", { ascending: false }),
        supabase.from("site_settings").select("data").eq("id", "brand").maybeSingle(),
      ]);
      if (!listingsResult.error && listingsResult.data) setAllProperties((listingsResult.data as unknown as PropertyDatabaseRow[]).map(propertyFromDatabase));
      else if (listingsResult.error) console.error("No se pudo cargar el catálogo de Supabase", listingsResult.error.message);
      if (!settingsResult.error && settingsResult.data?.data) setSettings({ ...defaultBrandSettings, ...(settingsResult.data.data as Partial<BrandSettings>), colors: { ...defaultBrandSettings.colors, ...((settingsResult.data.data as Partial<BrandSettings>).colors || {}) } });
    } catch (error) { console.error("No se pudo cargar el contenido publicado", error); }
    finally { setContentLoaded(true); }
  };
  useEffect(() => { if (clientReady) void reloadContent(); }, [clientReady]);
  useEffect(() => {
    document.documentElement.style.setProperty("--forest", settings.colors.forest);
    document.documentElement.style.setProperty("--gold", settings.colors.gold);
    document.documentElement.style.setProperty("--gold-light", settings.colors.gold);
    document.documentElement.style.setProperty("--ink", settings.colors.ink);
    document.documentElement.style.setProperty("--paper", settings.colors.paper);
    document.title = `${settings.brandName} | ${settings.brandSubtitle}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", settings.siteDescription);
  }, [settings]);
  const visibleProperties = useMemo(() => allProperties.filter(p => {
    const q = filters.query.trim().toLowerCase();
    const searchable = `${p.name} ${p.location} ${p.municipality} ${p.department}`.toLowerCase();
    const categoryMatch = filters.category === "Todas" || filters.category === "Warm" && ["Carmen de Apicalá", "Ricaurte"].includes(p.municipality) || p.categories?.includes(filters.category as "Buy" | "Rent" | "Projects" | "Commercial");
    return (!q || searchable.includes(q)) && categoryMatch && (filters.type === "Todos" || p.type === filters.type) && p.price >= filters.minPrice && p.price <= filters.maxPrice && p.bedrooms >= filters.bedrooms && p.bathrooms >= filters.bathrooms && p.area >= filters.minArea;
  }), [filters, allProperties]);
  return <AppContext.Provider value={{ filters, setFilters, visibleProperties, allProperties, contentLoaded, favorites, toggleFavorite, settings, reloadContent, setSettings }}>{children}</AppContext.Provider>;
}
export function usePropertyApp() { const value = useContext(AppContext); if (!value) throw new Error("usePropertyApp debe usarse dentro de AppProvider"); return value; }
