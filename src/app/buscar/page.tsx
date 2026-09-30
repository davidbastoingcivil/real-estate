"use client";
import { useState } from "react";
import { Map, Search } from "lucide-react";
import SearchFilters from "@/components/SearchFilters";
import PropertyCard from "@/components/PropertyCard";
import MapView from "@/components/MapView";
import { usePropertyApp } from "@/components/AppProvider";
export default function SearchPage() { const { visibleProperties,allProperties,contentLoaded }=usePropertyApp(); const [showMap,setShowMap]=useState(false); return <main className="app-page"><div className="app-page-heading"><div className="eyebrow"><span/> EXPLORA COLOMBIA</div><h1>Encuentra tu <em>lugar.</em></h1><p>Busca entre proyectos y hogares seleccionados para ti.</p></div><div className="search-layout"><SearchFilters/><section className="results-panel"><div className="results-toolbar"><b>{visibleProperties.length} {visibleProperties.length===1?"inmueble":"inmuebles"} <span>de {allProperties.length} disponibles</span></b><button className="map-toggle" onClick={()=>setShowMap(v=>!v)}><Map size={16}/>{showMap?"Ver lista":"Ver mapa"}</button></div>{showMap?<div className="search-map"><MapView/></div>:visibleProperties.length?<div className="property-grid">{visibleProperties.map(p=><PropertyCard property={p} key={p.id}/>)}</div>:!contentLoaded?<div className="empty-state"><b>Cargando catálogo…</b></div>:<div className="empty-state"><Search size={24}/><b>No hay resultados</b><span>Ajusta los filtros para descubrir otras propiedades.</span></div>}</section></div></main>; }
