"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { importBogotaCadastralCsv } from "@/app/admin/(dashboard)/actions";

/** Decode a CSV as UTF-8 and fall back to Windows-1252 (common in Bogotá exports). */
async function readCsv(file: File) {
  const bytes = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

export default function BogotaCadastralImport({ propertyId }: { propertyId: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) { setMessage({ kind: "error", text: "El archivo supera 5 MB. Descarga solo el predio del inmueble." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const result = await importBogotaCadastralCsv(propertyId, await readCsv(file));
      if (!result.success) setMessage({ kind: "error", text: result.error });
      else {
        const parcel = result.parcel;
        setMessage({ kind: "ok", text: `Importado ${parcel.chip} · ${parcel.officialAddress || "sin dirección"} · terreno ${parcel.lotAreaM2 ?? "s/d"} m² · construida ${parcel.builtAreaM2 ?? "s/d"} m². Recargando la ficha…` });
        // Reload so the form shows the imported CHIP, NPN and areas (saving a stale form would overwrite them).
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setMessage({ kind: "error", text: "No se pudo leer el archivo. Verifica que sea el CSV descargado de Catastro Bogotá." });
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-cms-form-section">
    <h2>Catastro Bogotá (UAECD)</h2>
    <p className="admin-cms-help">Para inmuebles en Bogotá, descarga la información del lote o predio en <a href="https://ideca.gov.co/recursos/los-mas-consultados/lote" target="_blank" rel="noreferrer">IDECA</a> (consulta por dirección o CHIP) o el archivo Predio.csv de datos abiertos, y cárgalo aquí. Se completan CHIP, cédula catastral, número predial nacional y áreas oficiales, y el informe PDF agrega la ficha predial distrital.</p>
    <label className="button button-outline admin-cms-upload-button"><FileUp size={15}/>{busy ? "Importando…" : "Importar CSV de Catastro Bogotá"}<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void onFile(event)}/></label>
    {message && <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "admin-cms-row-error" : "admin-cms-row-note"} style={{ maxWidth: "none", fontSize: 12, marginTop: 10 }}>{message.text}</p>}
  </section>;
}
