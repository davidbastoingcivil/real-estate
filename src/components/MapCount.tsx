"use client";
import { usePropertyApp } from "@/components/AppProvider";
export default function MapCount(){const {visibleProperties}=usePropertyApp();return <div className="map-label"><span className="map-pulse"/> {visibleProperties.length} {visibleProperties.length===1?"PROPIEDAD DISPONIBLE":"PROPIEDADES DISPONIBLES"}</div>;}
