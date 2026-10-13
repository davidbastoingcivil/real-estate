"use client";

import { useEffect, useState } from "react";
import { Activity, BadgeInfo, MapPinned } from "lucide-react";
import type { AvmResult } from "@/lib/avm/valuationEngine";
import { formatCOP } from "@/data/properties";
import ComparablesTable from "@/components/avm/ComparablesTable";
import DownloadPdfButton from "@/components/avm/DownloadPdfButton";

export default function ValuationSummaryCard({ propertyId }: { propertyId: number }) {
  const [data, setData] = useState<AvmResult | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [valuationId, setValuationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/avm/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId }),
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      const body = await response.json() as AvmResult & { error?: string; is_admin?: boolean; valuation_id?: string | null };
      if (!response.ok) throw new Error(body.error || "No se pudo calcular la referencia de mercado.");
      setData(body);
      setIsAdmin(Boolean(body.is_admin));
      setValuationId(body.valuation_id ?? null);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se pudo cargar la estimación.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [propertyId]);

  async function saveValuation() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/avm/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, persist: true }),
        cache: "no-store",
      });
      const body = await response.json() as AvmResult & { error?: string; valuation_id?: string | null };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la estimación.");
      setData(body);
      setValuationId(body.valuation_id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la estimación.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="avm-card" aria-labelledby="avm-heading">
    <div className="avm-card-heading"><div><span className="avm-kicker"><Activity size={14}/> ANÁLISIS DE MERCADO</span><h2 id="avm-heading">Referencia de <em>valor.</em></h2></div><span className="avm-tag">Estimación automática</span></div>
    {loading ? <p className="avm-loading">Analizando propiedades comparables…</p> : !data ? <p className="avm-error" role="status">{error || "No se pudo cargar la estimación."}</p> : <>
      <div className="avm-value-grid">
        <div className="avm-value-main"><small>VALOR COMERCIAL ESTIMADO</small><strong>{formatCOP(data.estimated_value)}</strong><span>Rango {formatCOP(data.value_min)} – {formatCOP(data.value_max)}</span></div>
        <div className="avm-metric"><small>VALOR POR M²</small><b>{formatCOP(data.value_per_m2)}</b></div>
        <div className="avm-metric"><small>CANON MENSUAL INDICATIVO</small><b>{formatCOP(data.estimated_rent)}</b></div>
        <div className="avm-metric"><small>CONFIANZA DE LA MUESTRA</small><b>{data.confidence_score}%</b></div>
      </div>
      <div className="avm-section-title"><MapPinned size={15}/> Comparables utilizados <span>{data.methodology.comparable_count}</span></div>
      <ComparablesTable comparables={data.comparables}/>
      <div className="avm-footnote"><BadgeInfo size={15}/><p>Estimación automática orientativa, basada en anuncios publicados. No es un avalúo comercial certificado. La confianza depende de la cantidad y dispersión de los comparables.</p></div>
      {error && <p className="avm-error" role="status">{error}</p>}
      <div className="avm-actions">{isAdmin && !valuationId && <button className="avm-save" type="button" onClick={saveValuation} disabled={saving}>{saving ? "Guardando…" : "Guardar en historial"}</button>}<DownloadPdfButton propertyId={propertyId} valuationId={valuationId}/></div>
      {valuationId && <p className="avm-saved">Estimación guardada en el historial del administrador.</p>}
    </>}
  </section>;
}
