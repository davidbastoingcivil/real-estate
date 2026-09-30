"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { createLead } from "@/app/propiedades/actions";

export default function LeadForm({ propertyId }: { propertyId?: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const result = await createLead({
        name: String(data.get("name") || ""),
        phone_number: String(data.get("phone") || ""),
        interested_property_id: propertyId,
        website: String(data.get("website") || ""),
      });
      if (result.success) {
        form.reset();
        setSuccess(true); setMessage("Gracias. David se pondrá en contacto contigo.");
      } else setMessage(result.error);
    } catch {
      setMessage("No pudimos enviar tu solicitud. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="lead-form-section"><div className="eyebrow"><span/> HABLEMOS</div><h3>¿Te interesa este espacio?</h3><p>Déjanos tu nombre y teléfono para recibir información personalizada.</p>
    <form className="lead-form" onSubmit={submit}>
      <label>Nombre<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Tu nombre"/></label>
      <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={24} placeholder="+57 300 000 0000"/></label>
      <label className="lead-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      <button className="button button-outline" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin"/> : <ArrowUpRight size={15}/>} {busy ? "Enviando…" : "Solicitar información"}</button>
      {message && <p role={success ? "status" : "alert"} className={success ? "lead-feedback success" : "lead-feedback error"}>{message}</p>}
      <small>Al enviar aceptas que usemos estos datos para responder tu solicitud.</small>
    </form>
  </section>;
}
