"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function DownloadPdfButton({ propertyId, valuationId }: { propertyId: number; valuationId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setLoading(true);
    setError("");
    try {
      const resource = valuationId ? `valuationId=${encodeURIComponent(valuationId)}` : `property_id=${propertyId}`;
      const response = await fetch(`/api/avm/pdf?${resource}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "No se pudo generar el informe.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Estimacion-AVM-David-Basto.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo descargar el informe.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="avm-download-wrap">
    <button className="avm-download" type="button" onClick={download} disabled={loading}>
      <Download size={16}/>{loading ? "Preparando informe…" : "Descargar informe PDF"}
    </button>
    {error && <p className="avm-error" role="alert">{error}</p>}
  </div>;
}
