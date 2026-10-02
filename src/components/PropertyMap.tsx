"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CircleMarker, MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
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

type BasemapStatus = "loading" | "ready" | "missing-key" | "unavailable";
type MapLibreError = { error?: { status?: number; message?: string } };
type MapLibreMap = {
  on: (event: "load" | "error", callback: (event: MapLibreError) => void) => void;
  off: (event: "load" | "error", callback: (event: MapLibreError) => void) => void;
  isStyleLoaded: () => boolean;
};
type ArcGISLayer = L.Layer & { getMaplibreMap?: () => MapLibreMap };

function ArcGISBasemap({ style, onStatus }: { style: BasemapStyle; onStatus: (status: BasemapStatus) => void }) {
  const map = useMap();
  useEffect(() => {
    const apikey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY?.trim();
    let disposed = false;
    let layer: ArcGISLayer | null = null;
    let fallback: L.TileLayer | null = null;
    let glMap: MapLibreMap | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let onLoad: ((event: MapLibreError) => void) | undefined;
    let onError: ((event: MapLibreError) => void) | undefined;
    const clearFallbackTimer = () => { if (fallbackTimer) clearTimeout(fallbackTimer); };

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
      glMap = basemapLayer.getMaplibreMap?.();
      onLoad = () => { clearFallbackTimer(); if (!disposed) onStatus("ready"); };
      onError = event => {
        const status = event.error?.status;
        if (!disposed && (status === 401 || status === 403)) {
          clearFallbackTimer();
          if (layer) map.removeLayer(layer);
          layer = null;
          addFallback("unavailable");
        }
      };
      glMap?.on("load", onLoad);
      glMap?.on("error", onError);
      fallbackTimer = setTimeout(() => {
        if (!disposed && !glMap?.isStyleLoaded()) {
          if (layer) map.removeLayer(layer);
          layer = null;
          addFallback("unavailable");
        }
      }, 9000);
      onStatus("loading");
    } catch {
      addFallback("unavailable");
    }
    return () => {
      disposed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (glMap && onLoad) glMap.off("load", onLoad);
      if (glMap && onError) glMap.off("error", onError);
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
  const fitted = useRef(false);
  useEffect(() => {
    if (!properties.length || fitted.current) return;
    fitted.current = true;
    if (properties.length === 1) {
      map.setView([properties[0].lat, properties[0].lng], 11, { animate: true });
      return;
    }
    map.fitBounds(properties.map(property => [property.lat, property.lng] as [number, number]), { padding: [44, 44], maxZoom: 11, animate: true });
  }, [map, properties]);
  return null;
}

function MapControls({ onStyleChange, basemapStyle, analysisMode, onAnalysisToggle }: {
  onStyleChange: (style: BasemapStyle) => void;
  basemapStyle: BasemapStyle;
  analysisMode: boolean;
  onAnalysisToggle: () => void;
}) {
  const map = useMap();
  const shellRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    shellRef.current = map.getContainer().closest(".property-map-shell");
    const update = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [map]);

  const reset = () => {
    map.setView([4.15, -74.72], 7, { animate: true });
  };
  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
    window.setTimeout(() => map.invalidateSize(), 80);
  };

  return <div className="map-tools" aria-label="Herramientas de mapa">
    <label className="map-basemap-picker"><span>Mapa base</span><select value={basemapStyle} onChange={event => onStyleChange(event.target.value as BasemapStyle)} aria-label="Estilo del mapa">
      {basemapOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <button type="button" className={`map-analysis-toggle ${analysisMode ? "active" : ""}`} aria-pressed={analysisMode} onClick={onAnalysisToggle}>
      {analysisMode ? "Ver inmuebles" : "Analizar precio/m²"}
    </button>
    <button type="button" className="map-icon-button" onClick={reset} aria-label="Volver a la vista de Colombia" title="Vista inicial"><RotateCcw size={15}/></button>
    <button type="button" className="map-icon-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Salir de pantalla completa" : "Ver mapa en pantalla completa"} title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>{fullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button>
  </div>;
}

function ClusteredProperties({ properties, analysisMode, stats }: {
  properties: Property[];
  analysisMode: boolean;
  stats: { q1: number; q3: number } | null;
}) {
  const map = useMap();
  const subscribe = useCallback((onChange: () => void) => {
    map.on("zoomend", onChange);
    map.on("moveend", onChange);
    return () => { map.off("zoomend", onChange); map.off("moveend", onChange); };
  }, [map]);
  const getSnapshot = useCallback(() => map.getZoom(), [map]);
  const getServerSnapshot = useCallback(() => 7, []);
  const zoom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const clusters = useMemo(() => {
    const buckets = new Map<string, Property[]>();
    const cellSize = zoom < 8 ? 64 : zoom < 11 ? 52 : zoom < 14 ? 36 : 1;
    for (const property of properties) {
      const point = map.project([property.lat, property.lng], zoom);
      const key = cellSize === 1 ? property.slug : `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
      const bucket = buckets.get(key) || [];
      bucket.push(property);
      buckets.set(key, bucket);
    }
    return [...buckets.values()].map(items => ({
      items,
      center: [items.reduce((total, property) => total + property.lat, 0) / items.length, items.reduce((total, property) => total + property.lng, 0) / items.length] as [number, number],
      value: items.reduce((total, property) => total + (unitPrice(property) || 0), 0) / items.length,
    }));
  }, [map, properties, zoom]);

  return <>{clusters.map(cluster => {
    const key = cluster.items.map(property => property.slug).join("-");
    if (cluster.items.length > 1) {
      const color = analysisMode && stats ? cluster.value <= stats.q1 ? "low" : cluster.value >= stats.q3 ? "high" : "mid" : "default";
      const icon = L.divIcon({ className: `map-cluster-icon ${analysisMode ? `analysis-${color}` : ""}`, html: `<span>${cluster.items.length}</span>`, iconSize: [42, 42], iconAnchor: [21, 21] });
      return <Marker key={key} position={cluster.center} icon={icon}>
        <Popup><div className="map-cluster-popup"><b>{cluster.items.length} inmuebles en esta zona</b>{cluster.items.map(property => <Link href={`/propiedades/${property.slug}`} key={property.slug}><span>{property.name}</span><strong>{formatCOP(property.price)}</strong>{analysisMode && unitPrice(property) ? <small>{formatUnitPrice(unitPrice(property) as number)}</small> : null}</Link>)}</div></Popup>
      </Marker>;
    }

    const property = cluster.items[0];
    const price = unitPrice(property);
    const color = !price || !stats ? "#d8c393" : price <= stats.q1 ? "#79bfa0" : price >= stats.q3 ? "#dc896e" : "#d8c393";
    if (analysisMode) return <CircleMarker key={property.slug} center={[property.lat, property.lng]} radius={9} pathOptions={{ color: "#10251b", weight: 2, fillColor: color, fillOpacity: .9 }}>
      <Popup><div className="map-analysis-popup"><b>{property.name}</b><span>{property.location}</span><strong>{price ? formatUnitPrice(price) : "Área no disponible"}</strong><Link href={`/propiedades/${property.slug}`}>Ver propiedad →</Link></div></Popup>
    </CircleMarker>;
    return <Marker key={property.slug} position={[property.lat, property.lng]} icon={pin}><Popup><div className="map-popup"><div className="popup-image"><DriveImage className="media-fill" src={property.image} alt={property.name}/></div><div className="popup-body"><span>{property.location}</span><b>{property.name}</b><strong>Desde {formatCOP(property.price)}</strong><Link href={`/propiedades/${property.slug}`}>Ver propiedad →</Link></div></div></Popup></Marker>;
  })}</>;
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
      let { data, error } = await supabase.rpc("get_properties_in_bounds_v2", { bounds_wkt: polygon, limit_count: 500 });
      if (error) {
        // Backwards compatible while the additive v2 migration is pending.
        const legacy = await supabase.rpc("get_properties_in_bounds", { bounds_wkt: polygon });
        data = legacy.data;
        error = legacy.error;
      }
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
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); requestSequence.current += 1; }, []);
  return null;
}

export default function PropertyMap() {
  const { visibleProperties } = usePropertyApp();
  const allLocated = useMemo(() => visibleProperties.filter(located), [visibleProperties]);
  const selectionKey = allLocated.map(property => property.slug).join("|");
  const [boundsResult, setBoundsResult] = useState<{ selection: string; properties: Property[] } | null>(null);
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>("arcgis/dark-gray");
  const [analysisMode, setAnalysisMode] = useState(false);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>("loading");
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
    {basemapStatus !== "ready" && <div className="map-fallback-note" role="status">{basemapStatus === "loading" ? "Cargando mapa ArcGIS…" : basemapStatus === "missing-key" ? "ArcGIS sin clave; mostrando mapa de respaldo." : "ArcGIS no disponible; mostrando mapa de respaldo."}</div>}
    {analysisMode && <aside className="map-analysis-legend" aria-live="polite">
      <b>Precio anunciado por m²</b>
      <span>Mediana visible: {marketStats ? formatUnitPrice(marketStats.median) : "Sin datos en esta zona"}</span>
      {marketStats && <small>{marketStats.count} inmuebles · cuartiles recalculados al mover el mapa</small>}
      <div><i className="analysis-low"/> Menor <i className="analysis-mid"/> Intermedio <i className="analysis-high"/> Mayor</div>
    </aside>}
    <MapContainer center={[4.15, -74.72]} zoom={7} scrollWheelZoom={false} className="leaflet-map">
      <MapControls basemapStyle={basemapStyle} onStyleChange={setBasemapStyle} analysisMode={analysisMode} onAnalysisToggle={() => setAnalysisMode(value => !value)}/>
      <ArcGISBasemap style={basemapStyle} onStatus={handleBasemapStatus}/>
      <FitVisibleProperties properties={allLocated}/>
      <BoundsSearch fallback={allLocated} onResults={handleResults}/>
      <ClusteredProperties properties={mapProperties} analysisMode={analysisMode} stats={marketStats}/>
    </MapContainer>
  </div>;
}
