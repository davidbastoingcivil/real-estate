"use client";
import { usePropertyApp } from "@/components/AppProvider";
import PropertyCard from "@/components/PropertyCard";
export default function PropertyListings() {
  const { filters, setFilters, visibleProperties } = usePropertyApp();
  const shortcuts = [{ label: "Todas", value: "Todas" }, { label: "Comprar", value: "Buy" }, { label: "Proyectos", value: "Projects" }, { label: "Clima cálido", value: "Warm" }];
  return <><div className="quick-filters" role="group" aria-label="Filtrar propiedades">{shortcuts.map(filter => <button type="button" key={filter.label} aria-pressed={filters.category === filter.value} className={filters.category === filter.value ? "filter-active" : ""} onClick={() => setFilters({ category: filter.value, query: "" })}>{filter.label}</button>)}</div><div className="property-grid">{visibleProperties.map(p => <PropertyCard key={p.id} property={p}/>)}</div>{visibleProperties.length === 0 && <p className="empty-state">No encontramos propiedades con esos filtros. Prueba con otros criterios.</p>}</>;
}
