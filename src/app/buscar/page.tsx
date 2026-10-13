"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Map, Search } from "lucide-react";
import SearchFilters from "@/components/SearchFilters";
import PropertyCard from "@/components/PropertyCard";
import MapView from "@/components/MapView";
import { usePropertyApp } from "@/components/AppProvider";

const MapLocationIntelligence = dynamic(() => import("@/components/MapLocationIntelligence"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparando el análisis territorial…</div>,
});

type SearchView = "list" | "map" | "geoai";

export default function SearchPage() {
  const { visibleProperties, allProperties, contentLoaded } = usePropertyApp();
  const [view, setView] = useState<SearchView>("list");

  return <main className="app-page">
    <div className="app-page-heading">
      <div className="eyebrow"><span/> EXPLORA COLOMBIA</div>
      <h1>Encuentra tu <em>lugar.</em></h1>
      <p>Busca entre proyectos y hogares seleccionados para ti.</p>
    </div>
    <div className="search-layout">
      <SearchFilters/>
      <section className="results-panel">
        <div className="results-toolbar">
          <b>{visibleProperties.length} {visibleProperties.length === 1 ? "inmueble" : "inmuebles"} <span>de {allProperties.length} disponibles</span></b>
          <div className="results-view-switch" role="group" aria-label="Vista de resultados">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-pressed={view === "list"}><Search size={15}/>Lista</button>
            <button className={view === "map" ? "active" : ""} onClick={() => setView(view === "map" ? "list" : "map")} aria-pressed={view === "map"}><Map size={15}/>Mapa</button>
            <button className={view === "geoai" ? "active" : ""} onClick={() => setView(view === "geoai" ? "list" : "geoai")} aria-pressed={view === "geoai"}><Activity size={15}/>GeoAI</button>
          </div>
        </div>
        {view === "map" ? <div className="search-map"><MapView/></div>
          : view === "geoai" ? <div className="search-map search-geoai-map"><MapLocationIntelligence properties={visibleProperties}/></div>
            : visibleProperties.length ? <div className="property-grid">{visibleProperties.map(property => <PropertyCard property={property} key={property.id}/>)}</div>
              : !contentLoaded ? <div className="empty-state"><b>Cargando catálogo…</b></div>
                : <div className="empty-state"><Search size={24}/><b>No hay resultados</b><span>Ajusta los filtros para descubrir otras propiedades.</span></div>}
      </section>
    </div>
  </main>;
}
