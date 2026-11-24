"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { deleteProperty, resyncPropertyIntegrations } from "./actions";

export default function PropertyRowActions({ id, title }: { id: number; title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  async function resync() {
    setSyncing(true);
    setError("");
    setSyncNote("");
    try {
      const result = await resyncPropertyIntegrations(id);
      if (!result.success) setError(result.error);
      else {
        const official = "status" in result.summary.official ? result.summary.official : null;
        const osm = "ok" in result.summary.osm ? result.summary.osm : null;
        setSyncNote([
          official ? `Catastro/DANE: ${official.status}` : null,
          osm ? `OSM: ${osm.ok ? "actualizado" : osm.message}` : null,
        ].filter(Boolean).join(" · "));
      }
    } catch {
      setError("No se pudo sincronizar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSyncing(false);
    }
  }
  async function remove() {
    if (!window.confirm(`¿Eliminar “${title}” del catálogo? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    try {
      const result = await deleteProperty(id);
      if (!result.success) setError(result.error);
    } catch {
      setError("No se pudo eliminar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="admin-cms-actions">
    {error && <span role="alert" className="admin-cms-row-error">{error}</span>}
    {syncNote && <span role="status" className="admin-cms-row-note">{syncNote}</span>}
    <button type="button" aria-label={`Sincronizar datos oficiales de ${title}`} onClick={() => void resync()} disabled={syncing}><RefreshCw size={16}/><span>{syncing ? "Sincronizando…" : "Sincronizar"}</span></button>
    <Link aria-label={`Editar ${title}`} href={`/admin/properties/${id}`}><Pencil size={16}/><span>Editar</span></Link>
    <button type="button" aria-label={`Eliminar ${title}`} onClick={() => void remove()} disabled={busy}><Trash2 size={16}/><span>{busy ? "Eliminando…" : "Eliminar"}</span></button>
  </div>;
}
