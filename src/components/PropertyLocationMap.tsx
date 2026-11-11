"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Property } from "@/data/properties";
import { hasUsableWgs84Coordinates } from "@/lib/geo/coordinates";

const LeafletLocationMap = dynamic(() => import("@/components/PropertyLocationMapLeaflet"), { ssr: false, loading: () => <div className="property-location-map-loading">Preparando el mapa…</div> });

export default function PropertyLocationMap({ property }: { property: Pick<Property, "name" | "location" | "lat" | "lng"> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!hasUsableWgs84Coordinates(property.lat, property.lng)) return null;
  return <section className="detail-block property-location-section"><div className="eyebrow"><span/> UBICACIÓN</div><h2>Un lugar para <em>descubrir.</em></h2><p>{property.location}</p>{ready&&<LeafletLocationMap property={property}/>}</section>;
}
