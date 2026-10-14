"use client";

import { FileText, ShieldCheck } from "lucide-react";
import DownloadPdfButton from "@/components/avm/DownloadPdfButton";

/** The public property page offers a zero-storage cadastral report, not market comps. */
export default function ValuationSummaryCard({ propertyId }: { propertyId: number }) {
  return <section className="avm-card" aria-labelledby="cadastral-report-heading">
    <div className="avm-card-heading">
      <div>
        <span className="avm-kicker"><FileText size={14}/> INFORMACIÓN PREDIAL</span>
        <h2 id="cadastral-report-heading">Conoce el <em>territorio.</em></h2>
      </div>
      <span className="avm-tag">Consulta al vuelo</span>
    </div>
    <p className="avm-report-copy">Genera un informe con la ficha del inmueble, consulta catastral, indicadores municipales, mapa y contexto de puntos de interés. Los datos externos no se guardan en la plataforma.</p>
    <div className="avm-footnote"><ShieldCheck size={15}/><p>Documento informativo. Los datos oficiales dependen de la cobertura de cada fuente y no reemplazan un avalúo certificado, el certificado de tradición ni la norma urbana oficial.</p></div>
    <div className="avm-actions"><DownloadPdfButton propertyId={propertyId}/></div>
  </section>;
}
