"use client";

import { useState } from "react";
import { LoaderCircle, MapPinned } from "lucide-react";

type AddressSuggestion = {
  display_name: string | null;
  neighbourhood: string | null;
  district: string | null;
  municipality: string | null;
  department: string | null;
  postcode: string | null;
};

type Result = {
  success?: boolean;
  error?: string;
  poi_count?: number;
  poi_warning?: string | null;
  address?: AddressSuggestion;
};

export default function OsmEnrichmentButton({ lat, lng, onAddressResolved }: {
  lat: number;
  lng: number;
  onAddressResolved: (address: AddressSuggestion) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function enrich() {
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/osm/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radius_meters: 500 }),
      });
      const result = await response.json() as Result;
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo consultar OpenStreetMap.");
      if (result.address) onAddressResolved(result.address);
      const countText = `${result.poi_count ?? 0} lugares OSM nuevos o actualizados en 500 m.`;
      setMessage({ kind: "success", text: `${countText} ${result.poi_warning || "Verifica la dirección sugerida antes de guardar."}` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "No fue posible consultar OpenStreetMap." });
    } finally {
      setLoading(false);
    }
  }

  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  return <div className="admin-osm-enrichment">
    <div>
      <b>Completar ubicación con OpenStreetMap</b>
      <p>Consulta una sugerencia de dirección y actualiza puntos cercanos para el mapa y GeoAI.</p>
    </div>
    <button type="button" className="button button-outline" onClick={() => void enrich()} disabled={loading || !hasCoordinates}>
      {loading ? <><LoaderCircle size={15} className="spin"/> Consultando…</> : <><MapPinned size={15}/> Consultar OSM</>}
    </button>
    {message && <p className={`admin-osm-notice ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
    <small>La consulta envía estas coordenadas a los servicios públicos de OpenStreetMap. Los datos son sugerencias comunitarias y deben verificarse.</small>
  </div>;
}
