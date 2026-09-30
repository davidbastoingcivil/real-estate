"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import DriveImage from "@/components/DriveImage";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { formatCOP } from "@/data/properties";
import { usePropertyApp } from "@/components/AppProvider";
import { getSupabaseClient } from "@/lib/supabase/client";

const pin = L.divIcon({ className: "gold-pin-wrap", html: '<span class="gold-pin">✦</span>', iconSize: [36, 42], iconAnchor: [18, 38] });
type Property = ReturnType<typeof usePropertyApp>["visibleProperties"][number];
type MapPropertyRow = { id: number; title: string; slug: string; price: number | string; type: Property["type"]; area: number | string; bedrooms: number; bathrooms: number; location: string; lat: number | string; lng: number | string; status: string; image: string | null };
const located = (property: Property) => Number.isFinite(property.lat) && Number.isFinite(property.lng) && (property.lat !== 0 || property.lng !== 0);
function propertyFromMapRow(row: MapPropertyRow): Property {
  const [municipality = "", department = ""] = row.location.split(",").map(part => part.trim());
  const image = row.image || "";
  return { id: row.slug, databaseId: row.id, slug: row.slug, name: row.title, location: row.location, municipality, department, price: Number(row.price), area: Number(row.area), type: row.type, status: row.status.toLocaleLowerCase("es").includes("vendido") ? "Vendido" : "En venta", categories: ["Buy"], bedrooms: row.bedrooms, bathrooms: row.bathrooms, image, gallery: image ? [image] : [], description: "", lat: Number(row.lat), lng: Number(row.lng), amenities: [], payment: [] };
}

function FitVisibleProperties({ properties }: { properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    if (!properties.length) return;
    if (properties.length === 1) {
      map.setView([properties[0].lat, properties[0].lng], 11, { animate: true });
      return;
    }
    map.fitBounds(properties.map(property => [property.lat, property.lng] as [number, number]), { padding: [44, 44], maxZoom: 11, animate: true });
  }, [map, properties]);
  return null;
}

function BoundsSearch({ fallback, onResults }: { fallback: Property[]; onResults: (properties: Property[]) => void }) {
  const map = useMap();
  const requestSequence = useRef(0);
  const search = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const bounds = map.getBounds();
    const south = bounds.getSouth(); const west = bounds.getWest();
    const north = bounds.getNorth(); const east = bounds.getEast();
    const coord = (value: number) => value.toFixed(6);
    const polygon = `POLYGON((${coord(west)} ${coord(south)},${coord(east)} ${coord(south)},${coord(east)} ${coord(north)},${coord(west)} ${coord(north)},${coord(west)} ${coord(south)}))`;
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.rpc("get_properties_in_bounds", { bounds_wkt: polygon });
      if (requestId !== requestSequence.current) return;
      if (!error && data) {
        const currentSelection = new Set(fallback.map(property => property.slug));
        onResults((data as unknown as MapPropertyRow[]).map(propertyFromMapRow).filter(property => located(property) && currentSelection.has(property.slug)));
        return;
      }
    }
    if (requestId !== requestSequence.current) return;
    // Keep the existing catalog map usable until the additive PostGIS migration is applied.
    onResults(fallback.filter(property => located(property) && bounds.contains([property.lat, property.lng])));
  }, [fallback, map, onResults]);
  useMapEvents({ moveend: () => void search() });
  useEffect(() => { void search(); }, [search]);
  return null;
}

export default function PropertyMap() {
  const { visibleProperties } = usePropertyApp();
  const allLocated = useMemo(() => visibleProperties.filter(located), [visibleProperties]);
  const selectionKey = allLocated.map(property => property.slug).join("|");
  const [boundsResult, setBoundsResult] = useState<{ selection: string; properties: Property[] } | null>(null);
  const handleResults = useCallback((properties: Property[]) => setBoundsResult({ selection: selectionKey, properties }), [selectionKey]);
  const mapProperties = boundsResult?.selection === selectionKey ? boundsResult.properties : allLocated;
  return <MapContainer center={[4.15, -74.72]} zoom={7} scrollWheelZoom={false} className="leaflet-map">
    <TileLayer className="brand-map-tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"/>
    <FitVisibleProperties properties={allLocated}/>
    <BoundsSearch fallback={allLocated} onResults={handleResults}/>
    {mapProperties.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pin}><Popup><div className="map-popup"><div className="popup-image"><DriveImage className="media-fill" src={p.image} alt={p.name}/></div><div className="popup-body"><span>{p.location}</span><b>{p.name}</b><strong>Desde {formatCOP(p.price)}</strong><Link href={`/propiedades/${p.slug}`}>Ver propiedad →</Link></div></div></Popup></Marker>)}
  </MapContainer>;
}
