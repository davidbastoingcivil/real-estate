"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { vectorBasemapLayer } from "esri-leaflet-vector/src/EsriLeafletVector.js";
import DriveImage from "@/components/DriveImage";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { formatCOP } from "@/data/properties";
import { usePropertyApp } from "@/components/AppProvider";
import { getSupabaseClient } from "@/lib/supabase/client";

const pin = L.divIcon({ className: "gold-pin-wrap", html: '<span class="gold-pin">✦</span>', iconSize: [36, 42], iconAnchor: [18, 38] });
type Property = ReturnType<typeof usePropertyApp>["visibleProperties"][number];
type MapPropertyRow = { id: number; title: string; slug: string; price: number | string; type: Property["type"]; area: number | string; bedrooms: number; bathrooms: number; location: string; lat: number | string; lng: number | string; status: string; image: string | null };
type BasemapStyle = "arcgis/dark-gray" | "arcgis/streets" | "arcgis/imagery";
const basemapOptions: { id: BasemapStyle; label: string }[] = [
  { id: "arcgis/dark-gray", label: "ArcGIS oscuro" },
  { id: "arcgis/streets", label: "Calles" },
  { id: "arcgis/imagery", label: "Satélite" },
];
const located = (property: Property) => Number.isFinite(property.lat) && Number.isFinite(property.lng) && (property.lat !== 0 || property.lng !== 0);
const unitPrice = (property: Property) => property.area > 0 ? property.price / property.area : null;
const formatUnitPrice = (value: number) => `${formatCOP(Math.round(value))} / m²`;

type BasemapStatus = "ready" | "missing-key" | "unavailable";
type ArcGISLayer = L.Layer;

function ArcGISBasemap({ style, onStatus }: { style: BasemapStyle; onStatus: (status: BasemapStatus) => void }) {
  const map = useMap();
  useEffect(() => {
    const apikey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY?.trim();
    let disposed = false;
    let layer: ArcGISLayer | null = null;
    let fallback: L.TileLayer | null = null;

    const addFallback = (status: BasemapStatus) => {
      if (disposed) return;
      fallback = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      }).addTo(map);
      onStatus(status);
    };

    if (!apikey) {
      addFallback("missing-key");
      return () => { disposed = true; if (fallback) map.removeLayer(fallback); };
    }

    try {
      const basemapLayer = vectorBasemapLayer(style, { apikey, version: 2, language: "es" }) as ArcGISLayer;
      layer = basemapLayer;
      basemapLayer.addTo(map);
      // The Esri layer loads its style and vector tiles asynchronously; transient
      // glyph/tile errors must not replace a basemap that is already rendering.
      onStatus("ready");
    } catch {
      addFallback("unavailable");
    }
    return () => {
      disposed = true;
      if (layer) map.removeLayer(layer);
      if (fallback) map.removeLayer(fallback);
    };
  }, [map, onStatus, style]);
  return null;
}
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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useMapEvents({ moveend: () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void search(), 180);
  } });
  useEffect(() => { void search(); }, [search]);
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);
  return null;
}

export default function PropertyMap() {
  const { visibleProperties } = usePropertyApp();
  const allLocated = useMemo(() => visibleProperties.filter(located), [visibleProperties]);
  const selectionKey = allLocated.map(property => property.slug).join("|");
  const [boundsResult, setBoundsResult] = useState<{ selection: string; properties: Property[] } | null>(null);
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>("arcgis/dark-gray");
  const [analysisMode, setAnalysisMode] = useState(false);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("ready");
  const handleResults = useCallback((properties: Property[]) => setBoundsResult({ selection: selectionKey, properties }), [selectionKey]);
  const handleBasemapStatus = useCallback((status: BasemapStatus) => setBasemapStatus(status), []);
  const mapProperties = boundsResult?.selection === selectionKey ? boundsResult.properties : allLocated;
  const marketStats = useMemo(() => {
    const values = mapProperties.map(unitPrice).filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
    if (!values.length) return null;
    const quantile = (fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
    return { count: values.length, q1: quantile(.25), median: quantile(.5), q3: quantile(.75) };
  }, [mapProperties]);

  return <div className="property-map-shell">
    <div className="map-tools" aria-label="Herramientas de mapa">
      <label className="map-basemap-picker"><span>Mapa base</span><select value={basemapStyle} onChange={event => setBasemapStyle(event.target.value as BasemapStyle)} aria-label="Estilo del mapa">
        {basemapOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <button type="button" className={`map-analysis-toggle ${analysisMode ? "active" : ""}`} aria-pressed={analysisMode} onClick={() => setAnalysisMode(value => !value)}>
        {analysisMode ? "Ver inmuebles" : "Analizar precio/m²"}
      </button>
    </div>
    {basemapStatus !== "ready" && <div className="map-fallback-note" role="status">{basemapStatus === "missing-key" ? "ArcGIS sin clave; mostrando mapa de respaldo." : "ArcGIS no disponible; mostrando mapa de respaldo."}</div>}
    {analysisMode && <aside className="map-analysis-legend" aria-live="polite">
      <b>Precio anunciado por m²</b>
      <span>Mediana visible: {marketStats ? formatUnitPrice(marketStats.median) : "Sin datos en esta zona"}</span>
      {marketStats && <small>{marketStats.count} inmuebles · cuartiles recalculados al mover el mapa</small>}
      <div><i className="analysis-low"/> Menor <i className="analysis-mid"/> Intermedio <i className="analysis-high"/> Mayor</div>
    </aside>}
    <MapContainer center={[4.15, -74.72]} zoom={7} scrollWheelZoom={false} className="leaflet-map">
      <ArcGISBasemap style={basemapStyle} onStatus={handleBasemapStatus}/>
      <FitVisibleProperties properties={allLocated}/>
      <BoundsSearch fallback={allLocated} onResults={handleResults}/>
      {mapProperties.map(p => {
        if (analysisMode) {
          const price = unitPrice(p);
          const color = !price || !marketStats ? "#d8c393" : price <= marketStats.q1 ? "#79bfa0" : price >= marketStats.q3 ? "#dc896e" : "#d8c393";
          return <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: "#10251b", weight: 2, fillColor: color, fillOpacity: .9 }}>
            <Popup><div className="map-analysis-popup"><b>{p.name}</b><span>{p.location}</span><strong>{price ? formatUnitPrice(price) : "Área no disponible"}</strong><Link href={`/propiedades/${p.slug}`}>Ver propiedad →</Link></div></Popup>
          </CircleMarker>;
        }
        return <Marker key={p.id} position={[p.lat, p.lng]} icon={pin}><Popup><div className="map-popup"><div className="popup-image"><DriveImage className="media-fill" src={p.image} alt={p.name}/></div><div className="popup-body"><span>{p.location}</span><b>{p.name}</b><strong>Desde {formatCOP(p.price)}</strong><Link href={`/propiedades/${p.slug}`}>Ver propiedad →</Link></div></div></Popup></Marker>;
      })}
    </MapContainer>
  </div>;
}
