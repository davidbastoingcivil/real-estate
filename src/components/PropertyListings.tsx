"use client";
import { ArrowUpRight } from "lucide-react";
import { usePropertyApp } from "@/components/AppProvider";
import DriveImage from "@/components/DriveImage";
import PropertyCard from "@/components/PropertyCard";
import type { Property } from "@/data/properties";

const shortcuts = [
  { label: "Todas", caption: "Todo el catálogo", value: "Todas" },
  { label: "Comprar", caption: "En venta", value: "Buy" },
  { label: "Arrendar", caption: "En arriendo", value: "Rent" },
  { label: "Proyectos", caption: "Inversión", value: "Projects" },
  { label: "Clima cálido", caption: "Tolima y alrededores", value: "Warm" },
];

// Same rule as the catalog filter in AppProvider, used here only to show counts and a cover photo.
const matches = (property: Property, value: string) => value === "Todas"
  || (value === "Warm" && ["Carmen de Apicalá", "Ricaurte"].includes(property.municipality || ""))
  || Boolean(property.categories?.includes(value as "Buy" | "Rent" | "Projects" | "Commercial"));

const isPhoto = (url: string | undefined) => Boolean(url) && !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(url || "");

export default function PropertyListings() {
  const { filters, setFilters, visibleProperties, allProperties } = usePropertyApp();
  const used = new Set<string>();
  const tiles = shortcuts.map(shortcut => {
    const members = allProperties.filter(property => matches(property, shortcut.value));
    // Prefer a cover not already used by a previous tile so the row looks varied.
    const cover = members.map(property => property.image).find(url => isPhoto(url) && !used.has(url || ""))
      || members.map(property => property.image).find(isPhoto);
    if (cover) used.add(cover);
    return { ...shortcut, count: members.length, cover };
  });
  return <>
    <div className="quick-filters category-tiles" role="group" aria-label="Filtrar propiedades por categoría">
      {tiles.map(tile => <button type="button" key={tile.value} aria-pressed={filters.category === tile.value}
        className={`category-tile${filters.category === tile.value ? " filter-active" : ""}`}
        onClick={() => setFilters({ category: tile.value, query: "" })}>
        {tile.cover ? <DriveImage className="category-tile-image" src={tile.cover} alt=""/> : <span className="category-tile-image category-tile-placeholder"/>}
        <span className="category-tile-shade"/>
        <span className="category-tile-copy"><b>{tile.label}</b><small>{tile.count} {tile.count === 1 ? "inmueble" : "inmuebles"} · {tile.caption}</small></span>
        <span className="category-tile-arrow"><ArrowUpRight size={15}/></span>
      </button>)}
    </div>
    <div className="property-grid">{visibleProperties.map(p => <PropertyCard key={p.id} property={p}/>)}</div>
    {visibleProperties.length === 0 && <p className="empty-state">No encontramos propiedades con esos filtros. Prueba con otros criterios.</p>}
  </>;
}
