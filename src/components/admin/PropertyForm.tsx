"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import { createProperty, updateProperty, type PropertyInput } from "@/app/admin/(dashboard)/actions";

export type PropertyFormData = PropertyInput & { id: number };

const empty: Omit<PropertyFormData, "id"> = {
  title: "", description: "", price: 0, type: "Casa", area_sqm: 0,
  bedrooms: 0, bathrooms: 0, location_text: "", status: "Disponible", lat: 0, lng: 0,
};

export default function PropertyForm({ initialData }: { initialData?: PropertyFormData }) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<PropertyFormData, "id">>(initialData || empty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    const result = initialData ? await updateProperty(initialData.id, form) : await createProperty(form);
    if (!result.success) {
      setNotice({ kind: "error", text: result.error });
      setIsSubmitting(false);
      return;
    }
    setNotice({ kind: "success", text: initialData ? "El inmueble quedó actualizado." : "El inmueble quedó creado." });
    router.push("/admin");
    router.refresh();
  }
  return <>
    <Link className="admin-cms-back" href="/admin"><ArrowLeft size={16}/> Volver al panel</Link>
    <div className="admin-page-title admin-cms-title"><div><div className="eyebrow"><span/> {initialData ? "ACTUALIZACIÓN" : "NUEVO REGISTRO"}</div><h1>{initialData ? "Editar inmueble" : "Agregar inmueble"}</h1><p>Completa la información para mantener actualizado el catálogo.</p></div></div>
    <form className="admin-cms-form" onSubmit={submit}>
      <section className="admin-cms-form-section"><h2>Información del inmueble</h2><div className="admin-cms-form-grid">
        <label className="admin-field admin-cms-span-2">Nombre o título<input required maxLength={160} value={form.title} onChange={e => field("title", e.target.value)} placeholder="Ej. Casa moderna en Carmen de Apicalá"/></label>
        <label className="admin-field">Tipo de inmueble<select value={form.type} onChange={e => field("type", e.target.value)}>{["Casa", "Apartamento", "Villa", "Lote", "Comercial"].map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="admin-field">Estado<select value={form.status} onChange={e => field("status", e.target.value as PropertyInput["status"])}><option>Disponible</option><option>Vendido</option><option>Oculto</option></select></label>
        <label className="admin-field">Precio (COP)<input required type="number" min="0" step="100000" value={form.price} onChange={e => field("price", Number(e.target.value))}/></label>
        <label className="admin-field">Área (m²)<input required type="number" min="0" step="0.01" value={form.area_sqm} onChange={e => field("area_sqm", Number(e.target.value))}/></label>
        <label className="admin-field">Habitaciones<input type="number" min="0" step="1" value={form.bedrooms} onChange={e => field("bedrooms", Number(e.target.value))}/></label>
        <label className="admin-field">Baños<input type="number" min="0" step="1" value={form.bathrooms} onChange={e => field("bathrooms", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Ubicación<input required value={form.location_text} onChange={e => field("location_text", e.target.value)} placeholder="Municipio, departamento"/></label>
        <label className="admin-field">Latitud<input type="number" step="any" value={form.lat} onChange={e => field("lat", Number(e.target.value))}/></label>
        <label className="admin-field">Longitud<input type="number" step="any" value={form.lng} onChange={e => field("lng", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Descripción<textarea rows={5} value={form.description} onChange={e => field("description", e.target.value)}/></label>
      </div></section>
      <section className="admin-cms-image-placeholder"><ImagePlus size={20}/><div><b>Imágenes del inmueble</b><p>Módulo de subida de imágenes — próxima fase. Las fotos existentes se conservan al actualizar.</p></div></section>
      {notice && <div className={notice.kind === "success" ? "admin-success" : "admin-error"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
      <div className="admin-cms-form-footer"><Link className="button button-outline" href="/admin">Cancelar</Link><button className="button button-dark" disabled={isSubmitting}><Save size={16}/>{isSubmitting ? "Guardando…" : initialData ? "Guardar cambios" : "Crear inmueble"}</button></div>
    </form>
  </>;
}
