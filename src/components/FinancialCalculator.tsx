"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";

const cop = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);

export default function FinancialCalculator({ precioTotal }: { precioTotal: number }) {
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);
  const [effectiveAnnualRate, setEffectiveAnnualRate] = useState(12);
  const [years, setYears] = useState(15);
  const [investment, setInvestment] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const calculations = useMemo(() => {
    const initialPayment = precioTotal * downPaymentPercent / 100;
    const principal = Math.max(0, precioTotal - initialPayment);
    const months = years * 12;
    const monthlyRate = Math.pow(1 + effectiveAnnualRate / 100, 1 / 12) - 1;
    const monthlyPayment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    const grossYield = precioTotal > 0 ? monthlyRent * 12 / precioTotal * 100 : 0;
    return { initialPayment, principal, monthlyRate, monthlyPayment, grossYield, cashFlow: monthlyRent - monthlyPayment };
  }, [precioTotal, downPaymentPercent, effectiveAnnualRate, years, monthlyRent]);

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
  </section>;
}
