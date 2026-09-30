"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteProperty } from "./actions";

export default function PropertyRowActions({ id, title }: { id: number; title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    <Link aria-label={`Editar ${title}`} href={`/admin/properties/${id}`}><Pencil size={16}/><span>Editar</span></Link>
    <button type="button" aria-label={`Eliminar ${title}`} onClick={() => void remove()} disabled={busy}><Trash2 size={16}/><span>{busy ? "Eliminando…" : "Eliminar"}</span></button>
  </div>;
}
