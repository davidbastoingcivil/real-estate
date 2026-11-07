"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { createLead } from "@/app/propiedades/actions";

type OwnerLeadType = "sell_property" | "rent_property";

export default function OwnerLeadForm({ kind }: { kind: OwnerLeadType }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const isSale = kind === "sell_property";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const details = [
        `Solicitud: ${isSale ? "vender" : "arrendar"} inmueble propio`,
        `Tipo: ${String(data.get("propertyType") || "No especificado")}`,
        `Ubicación: ${String(data.get("location") || "No especificada")}`,
        `Precio esperado: ${String(data.get("price") || "No especificado")}`,
        `Mensaje: ${String(data.get("details") || "Sin mensaje adicional")}`,
      ].join("\n");
      const result = await createLead({
        name: String(data.get("name") || ""),
        phone_number: String(data.get("phone") || ""),
        website: String(data.get("website") || ""),
        lead_type: kind,
        details,
        consent_accepted: data.get("consent") === "on",
      });
      if (!result.success) throw new Error(result.error);
      form.reset();
      setSuccess(true);
      setMessage("Recibimos tu solicitud. David te contactará para conversar sobre el inmueble.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="owner-lead-form" onSubmit={submit}>
    <div className="owner-form-heading"><div className="eyebrow"><span/> ASESORÍA PERSONAL</div><h2>{isSale ? "Cuéntame sobre tu inmueble." : "Hablemos de tu propiedad."}</h2><p>{isSale ? "Revisaremos zona, características y valor esperado para acordar el siguiente paso." : "Conversemos sobre la administración, el canon y el perfil ideal de arrendatario."}</p></div>
    <label>Nombre completo<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Tu nombre"/></label>
    <label>WhatsApp de contacto<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={24} placeholder="+57 300 000 0000"/></label>
    <label>Tipo de inmueble<select name="propertyType" defaultValue="Casa"><option>Casa</option><option>Apartamento</option><option>Villa</option><option>Lote</option><option>Local u oficina</option><option>Otro</option></select></label>
    <label>Ubicación<input name="location" required minLength={3} maxLength={120} placeholder="Ciudad, barrio o municipio"/></label>
    <label>{isSale ? "Valor esperado" : "Canon mensual esperado"}<input name="price" type="number" min="0" max="100000000000" step="100000" placeholder="COP"/></label>
    <label>Detalles adicionales<textarea name="details" rows={4} maxLength={1200} placeholder="Área, habitaciones, disponibilidad u otra información útil"/></label>
    <label className="lead-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <label className="lead-consent"><input name="consent" type="checkbox" required/><span>Autorizo el uso de estos datos para gestionar esta solicitud y que David Basto me contacte sobre el inmueble.</span></label>
    <button className="button button-dark" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <ArrowUpRight size={16}/>} {busy ? "Enviando…" : isSale ? "Solicitar asesoría de venta" : "Solicitar asesoría de arriendo"}</button>
    {message && <p className={success ? "lead-feedback success" : "lead-feedback error"} role={success ? "status" : "alert"}>{message}</p>}
  </form>;
}
