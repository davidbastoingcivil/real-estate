"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, Geometry } from "geojson";
import Link from "next/link";
import { Activity, Layers3, LoaderCircle, MapPin, Route } from "lucide-react";
import { formatCOP, type Property } from "@/data/properties";
import { usePropertyApp } from "@/components/AppProvider";
import type { GeoAiAnalysis, TravelMode } from "@/lib/geoaiEngine";

type ApiResponse = GeoAiAnalysis & {
  property: { id: number; title: string } | null;
  coordinates: { lat: number; lng: number };
  error?: string;
};

const located = (property: Property) => Number.isFinite(property.lat) && Number.isFinite(property.lng) && (property.lat !== 0 || property.lng !== 0);
const geoColor = (score: number | null) => score === null ? "#8d968d" : score >= 70 ? "#d1b36e" : score >= 40 ? "#8faf91" : "#a57b68";

function GeoAiBasemap() {
  const map = useMap();
  useEffect(() => {
    let disposed = false;
    let primary: L.TileLayer | null = null;
    let fallback: L.TileLayer | null = null;
    let tileErrors = 0;
    let primaryLoaded = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const addOpenStreetMapFallback = () => {
      if (disposed || fallback) return;
      fallback = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    };
    primary = L.tileLayer("https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    primary.on("load", () => { primaryLoaded = true; });
    primary.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors >= 3) addOpenStreetMapFallback();
    });
    fallbackTimer = setTimeout(() => {
      if (!disposed && !primaryLoaded) addOpenStreetMapFallback();
    }, 7000);
    return () => {
      disposed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (primary) map.removeLayer(primary);
      if (fallback) map.removeLayer(fallback);
    };
  }, [map]);
  return null;
}

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const resize = () => map.invalidateSize({ pan: false, debounceMoveend: true });
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const frame = requestAnimationFrame(resize);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [map]);
  return null;
}

function FocusLocation({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, Math.max(map.getZoom(), 13), { duration: 0.7 }); }, [map, position]);
  return null;
}

function formatScore(value: number | null) {
  return value === null ? "Sin datos" : `${(value / 10).toFixed(1)} / 10`;
}

export default function MapLocationIntelligence({ properties: propertySource }: { properties?: Property[] }) {
  const { allProperties } = usePropertyApp();
  const properties = useMemo(() => (propertySource ?? allProperties).filter(located), [allProperties, propertySource]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"properties" | "geoai">("properties");
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [minutes, setMinutes] = useState(10);
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");
  const [analysisResult, setAnalysisResult] = useState<{ key: string; data: ApiResponse } | null>(null);
  const [errorResult, setErrorResult] = useState<{ key: string; message: string } | null>(null);

  const selected = properties.find(property => property.id === selectedId) ?? properties[0] ?? null;
  const position: [number, number] | null = selected ? [selected.lat, selected.lng] : null;
  const analysisKey = selected ? `${selected.id}:${radiusMeters}:${minutes}:${travelMode}` : "";
  const analysis = analysisResult?.key === analysisKey ? analysisResult.data : null;
  const error = errorResult?.key === analysisKey ? errorResult.message : "";
  const loading = Boolean(analysisKey && !analysis && !error);

  useEffect(() => {
    if (!selected) return;
    const currentKey = `${selected.id}:${radiusMeters}:${minutes}:${travelMode}`;
    const controller = new AbortController();
    const query = new URLSearchParams({
      radius_meters: String(radiusMeters), minutes: String(minutes), travel_mode: travelMode,
    });
    if (selected.databaseId) query.set("property_id", String(selected.databaseId));
    else { query.set("lat", String(selected.lat)); query.set("lng", String(selected.lng)); }

    fetch(`/api/geoai/location-intelligence?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const result = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(result.error || "No se pudo completar el análisis territorial.");
        setAnalysisResult({ key: currentKey, data: result });
      })
      .catch(reason => { if (!controller.signal.aborted) setErrorResult({ key: currentKey, message: reason instanceof Error ? reason.message : "No se pudo consultar la inteligencia territorial." }); });
    return () => controller.abort();
  }, [selected, radiusMeters, minutes, travelMode]);

  const intelligence = analysis?.intelligence;
  const heatFeatures = analysis?.heatmap.features ?? [];
  const maxCellCount = Math.max(1, ...heatFeatures.map(feature => feature.properties.poi_count));
  const polygon = analysis?.isochrone as unknown as Feature<Geometry> | undefined;

  return <section className="geoai-map-shell" aria-label="Mapa de inteligencia territorial">
    <MapContainer center={position ?? [4.15, -74.72]} zoom={position ? 13 : 7} scrollWheelZoom className="geoai-leaflet-map">
      <InvalidateMapSize/>
      <GeoAiBasemap/>
      <FocusLocation position={position}/>
      {mode === "geoai" && polygon && <GeoJSON key={`${selectedId}-${minutes}-${travelMode}`} data={polygon} pathOptions={{ color: "#d1b36e", weight: 2, fillColor: "#d1b36e", fillOpacity: 0.13, dashArray: "6 5" }}/ >}
      {mode === "geoai" && position && intelligence && <Circle center={position} radius={radiusMeters} pathOptions={{ color: geoColor(intelligence.commercial_density_score), weight: 1, fillColor: geoColor(intelligence.commercial_density_score), fillOpacity: 0.075 }}/ >}
      {mode === "geoai" && heatFeatures.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const intensity = feature.properties.poi_count / maxCellCount;
        return <CircleMarker key={`${index}-${lat}-${lng}`} center={[lat, lng]} radius={7 + intensity * 13}
          pathOptions={{ color: "#f5e5bb", weight: 1, fillColor: "#d7a957", fillOpacity: 0.2 + intensity * 0.58 }}>
          <Popup><div className="geoai-popup"><b>{feature.properties.poi_count} puntos de interés</b><span>{Object.entries(feature.properties.categories).map(([category, count]) => `${category}: ${count}`).join(" · ")}</span></div></Popup>
        </CircleMarker>;
      })}
      {properties.map(property => <CircleMarker key={property.id} center={[property.lat, property.lng]} radius={property.id === selected?.id ? 9 : 6}
        pathOptions={{ color: property.id === selected?.id ? "#f7edda" : "#173a2b", weight: 2, fillColor: property.id === selected?.id ? "#d1b36e" : "#80b39b", fillOpacity: 0.95 }}
        eventHandlers={{ click: () => setSelectedId(property.id) }}>
        <Popup><div className="geoai-popup"><b>{property.name}</b><span>{property.location}</span><strong>{formatCOP(property.price)}</strong><Link href={`/propiedades/${property.slug}`}>Ver inmueble →</Link></div></Popup>
      </CircleMarker>)}
    </MapContainer>

    <div className="geoai-map-controls">
      <div className="geoai-mode-switch" role="tablist" aria-label="Capa del mapa">
        <button type="button" role="tab" aria-selected={mode === "properties"} className={mode === "properties" ? "active" : ""} onClick={() => setMode("properties")}><MapPin size={15}/> Inmuebles</button>
        <button type="button" role="tab" aria-selected={mode === "geoai"} className={mode === "geoai" ? "active" : ""} onClick={() => setMode("geoai")}><Activity size={15}/> GeoAI</button>
      </div>
      <label className="geoai-select"><span>Inmueble de análisis</span><select value={selected?.id ?? ""} onChange={event => setSelectedId(event.target.value)} disabled={!properties.length}>
        {properties.length ? properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>) : <option value="">No hay ubicaciones registradas</option>}
      </select></label>
      {mode === "geoai" && <>
        <div className="geoai-control-row"><label><span><Layers3 size={13}/> Radio de análisis</span><select value={radiusMeters} onChange={event => setRadiusMeters(Number(event.target.value))}><option value={500}>500 m</option><option value={1500}>1.5 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option></select></label>
          <label><span><Route size={13}/> Tiempo</span><select value={minutes} onChange={event => setMinutes(Number(event.target.value))}><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option></select></label></div>
        <label className="geoai-travel-mode"><span>Modo de desplazamiento</span><select value={travelMode} onChange={event => setTravelMode(event.target.value as TravelMode)}><option value="walking">A pie</option><option value="driving">En vehículo</option></select></label>
      </>}
    </div>

    {mode === "geoai" && <aside className="geoai-score-card" aria-live="polite">
      <div className="geoai-score-heading"><div><span>INTELIGENCIA TERRITORIAL</span><b>{selected?.name ?? "Selecciona un inmueble"}</b></div>{loading && <LoaderCircle size={17} className="spin" aria-label="Actualizando análisis"/>}</div>
      {error ? <p className="geoai-error">{error}</p> : <>
        <div className="geoai-opportunity"><span>Oportunidad espacial</span><strong>{loading ? "Calculando…" : formatScore(intelligence?.opportunity_score ?? null)}</strong></div>
        <div className="geoai-metric-grid">
          <div><span>Accesibilidad</span><b>{loading ? "Calculando…" : formatScore(intelligence?.accessibility_score ?? null)}</b></div>
          <div><span>Comercio</span><b>{loading ? "Calculando…" : formatScore(intelligence?.commercial_density_score ?? null)}</b></div>
          <div><span>Infraestructura</span><b>{loading ? "Calculando…" : formatScore(intelligence?.infrastructure_growth_score ?? null)}</b></div>
          <div><span>Riesgos</span><b>{loading ? "Calculando…" : formatScore(intelligence?.risk_score ?? null)}</b></div>
        </div>
        <div className="geoai-data-summary"><span>{intelligence?.total_pois ?? 0} POI en el radio</span><span>Confianza: {intelligence?.confidence ?? "no_data"}</span></div>
        {!loading && !intelligence?.total_pois && <small className="geoai-error">Sin puntos de interés georreferenciados para calcular métricas en esta ubicación y radio.</small>}
        <small className="geoai-disclaimer">Los círculos agregan POI cargados en la base. El polígono usa velocidad promedio y no representa rutas reales.</small>
        {analysis?.warnings.map(warning => <small className="geoai-error" key={warning}>{warning}</small>)}
      </>}
    </aside>}
  </section>;
}
