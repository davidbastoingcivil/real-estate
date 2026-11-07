"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Calculator, Download, LoaderCircle, TrendingUp, X } from "lucide-react";

const cop = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);

export default function FinancialCalculator({ precioTotal, propertyId, propertySlug, propertyName }: { precioTotal: number; propertyId?: number; propertySlug: string; propertyName: string }) {
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);
  const [effectiveAnnualRate, setEffectiveAnnualRate] = useState(12);
  const [years, setYears] = useState(15);
  const [investment, setInvestment] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [showDossier, setShowDossier] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientWhatsApp, setClientWhatsApp] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [dossierMessage, setDossierMessage] = useState("");
  const calculations = useMemo(() => {
    const initialPayment = precioTotal * downPaymentPercent / 100;
    const principal = Math.max(0, precioTotal - initialPayment);
    const months = years * 12;
    const monthlyRate = Math.pow(1 + effectiveAnnualRate / 100, 1 / 12) - 1;
    const monthlyPayment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    const grossYield = precioTotal > 0 ? monthlyRent * 12 / precioTotal * 100 : 0;
    return { initialPayment, principal, monthlyRate, monthlyPayment, grossYield, cashFlow: monthlyRent - monthlyPayment };
  }, [precioTotal, downPaymentPercent, effectiveAnnualRate, years, monthlyRent]);

  async function downloadDossier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDossierBusy(true);
    setDossierMessage("");
    try {
      if (!propertyId) throw new Error("Este informe requiere que el inmueble esté guardado en el catálogo para consultar sus datos reales.");
      const response = await fetch("/api/avm/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientWhatsApp,
          consentAccepted,
          propertyId,
          financialSimulation: {
            valorInmueble: precioTotal,
            porcentajeCuotaInicial: downPaymentPercent,
            valorCuotaInicial: calculations.initialPayment,
            capitalFinanciado: calculations.principal,
            tasaEfectivaAnual: effectiveAnnualRate,
            plazoAnos: years,
            cuotaMensualEstimada: calculations.monthlyPayment,
            arriendoEstimado: investment ? monthlyRent : 0,
            rentabilidadBrutaAnual: investment ? calculations.grossYield : 0,
            flujoCajaMensual: investment ? calculations.cashFlow : -calculations.monthlyPayment,
          },
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "No pudimos crear el PDF. Inténtalo otra vez.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Informe-Tecnico-Inversion-${propertySlug}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDossierMessage("Tu dossier personalizado se descargó.");
    } catch (error) {
      setDossierMessage(error instanceof Error ? error.message : "No pudimos crear el PDF. Inténtalo otra vez.");
    } finally {
      setDossierBusy(false);
    }
  }

  return <section className="financial-calculator" aria-labelledby="calculator-title">
    <div className="eyebrow"><span/> NÚMEROS CLAROS</div><h2 id="calculator-title"><Calculator size={20}/> Calcula tu inversión</h2>
    <p className="financial-intro">Una estimación para ayudarte a explorar escenarios de financiación. Las condiciones finales dependen de la entidad financiera.</p>
    <div className="financial-controls">
      <label className="financial-range"><span>Cuota inicial <b>{downPaymentPercent}%</b></span><input type="range" min="10" max="70" step="5" value={downPaymentPercent} onChange={e => setDownPaymentPercent(Number(e.target.value))}/></label>
      <label className="financial-range"><span>Tasa efectiva anual <b>{effectiveAnnualRate.toFixed(1)}%</b></span><input type="range" min="4" max="24" step="0.25" value={effectiveAnnualRate} onChange={e => setEffectiveAnnualRate(Number(e.target.value))}/></label>
      <label className="financial-select">Plazo<select value={years} onChange={e => setYears(Number(e.target.value))}>{[10, 15, 20].map(term => <option key={term} value={term}>{term} años</option>)}</select></label>
    </div>
    <div className="financial-primary-result"><span>Cuota mensual estimada</span><b>{cop(calculations.monthlyPayment)}</b><small>Tasa aproximada mes vencido: {(calculations.monthlyRate * 100).toFixed(2)}%</small></div>
    <div className="financial-metrics"><div><span>Cuota inicial</span><b>{cop(calculations.initialPayment)}</b></div><div><span>Capital financiado</span><b>{cop(calculations.principal)}</b></div></div>
    <button className={`financial-investment-toggle ${investment ? "active" : ""}`} type="button" role="switch" aria-checked={investment} onClick={() => setInvestment(value => !value)}><TrendingUp size={17}/> Analizar como inversión <span>{investment ? "Sí" : "No"}</span></button>
    {investment && <div className="financial-investment-panel"><label>Arriendo mensual estimado (COP)<input type="number" min="0" step="100000" value={monthlyRent} onChange={e => setMonthlyRent(Number(e.target.value))}/></label><div className="financial-metrics"><div><span>Rentabilidad bruta anual</span><b>{calculations.grossYield.toFixed(2)}%</b></div><div><span>Flujo mensual estimado</span><b className={calculations.cashFlow < 0 ? "negative" : "positive"}>{cop(calculations.cashFlow)}</b></div></div><small>El flujo resta la cuota de crédito al arriendo estimado; no incluye administración, impuestos, vacancia ni mantenimiento.</small></div>}
    <button type="button" className="financial-dossier-button" onClick={() => { setShowDossier(true); setDossierMessage(""); }}><Download size={16}/> Generar informe técnico y financiero (PDF)</button>
    {showDossier && <div className="dossier-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!dossierBusy)setShowDossier(false);}}><section className="dossier-modal" role="dialog" aria-modal="true" aria-labelledby="dossier-modal-title"><button className="dossier-modal-close" type="button" onClick={()=>setShowDossier(false)} aria-label="Cerrar" disabled={dossierBusy}><X size={18}/></button><div className="eyebrow"><span/> INFORME DE {propertyName.toUpperCase()}</div><h3 id="dossier-modal-title">¿A nombre de quién preparamos el informe?</h3><p>Consulta datos del inmueble y añade el escenario financiero actual. Los datos de contacto solo se usan para personalizar el PDF.</p><form onSubmit={downloadDossier}><label>Nombre completo<input autoComplete="name" required minLength={2} maxLength={100} value={clientName} onChange={event=>setClientName(event.target.value)} placeholder="Tu nombre"/></label><label>WhatsApp<input autoComplete="tel" type="tel" required minLength={7} maxLength={24} value={clientWhatsApp} onChange={event=>setClientWhatsApp(event.target.value)} placeholder="+57 300 000 0000"/></label><label className="dossier-consent"><input type="checkbox" checked={consentAccepted} onChange={event=>setConsentAccepted(event.target.checked)} required/><span>Acepto usar estos datos para personalizar y descargar este informe. No se guardan ni se usan para enviar mensajes.</span></label><button className="financial-dossier-button" type="submit" disabled={dossierBusy||!consentAccepted}>{dossierBusy?<LoaderCircle className="spin" size={16}/>:<Download size={16}/>} {dossierBusy?"Preparando PDF…":"Preparar y descargar informe"}</button>{dossierMessage&&<p className="dossier-feedback" role="status">{dossierMessage}</p>}</form></section></div>}
  </section>;
}
