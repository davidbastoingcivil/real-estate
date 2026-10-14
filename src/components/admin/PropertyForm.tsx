"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, ImagePlus, Link2, LoaderCircle, Save, Trash2, Upload, Plus } from "lucide-react";
import { createProperty, createPropertyType, updateProperty, type PropertyInput } from "@/app/admin/(dashboard)/actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import DriveImage from "@/components/DriveImage";
import OsmEnrichmentButton from "@/components/admin/OsmEnrichmentButton";

export type PropertyFormData = PropertyInput & { id: number };
export type PropertyTypeOption = { id: string; label: string };

const empty: Omit<PropertyFormData, "id"> = {
  title: "", description: "", price: 0, type: "Casa", area_sqm: 0,
  bedrooms: 0, bathrooms: 0, location_text: "", status: "Disponible", lat: 4.1472, lng: -74.7201,
  cadastral_id: "",
  municipality: "", department: "", features: [], categories: ["Buy"], payment: [], featured: false, images: [],
};

const categoryOptions: Array<{ id: PropertyInput["categories"][number]; label: string }> = [
  { id: "Buy", label: "Venta" }, { id: "Rent", label: "Arriendo" }, { id: "Projects", label: "Proyecto" }, { id: "Commercial", label: "Comercial" },
];
const defaultPropertyTypes: PropertyTypeOption[] = ["Casa", "Apartamento", "Villa", "Lote", "Comercial"].map(label => ({
  id: label.toLocaleLowerCase("es"), label,
}));

export default function PropertyForm({ initialData, propertyTypes = [] }: { initialData?: PropertyFormData; propertyTypes?: PropertyTypeOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<PropertyFormData, "id">>(initialData || empty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [media, setMedia] = useState<string[]>(initialData?.images || []);
  const [types, setTypes] = useState(propertyTypes.length ? propertyTypes : defaultPropertyTypes);
  const [newType, setNewType] = useState("");
  const [typeError, setTypeError] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteKind, setRemoteKind] = useState<"image" | "video">("image");
  const [isUploading, setIsUploading] = useState(false);
  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      const result = initialData ? await updateProperty(initialData.id, { ...form, images: media }) : await createProperty({ ...form, images: media });
      if (!result.success) {
        setNotice({ kind: "error", text: result.error });
        return;
      }
      setNotice({ kind: "success", text: initialData ? "El inmueble quedó actualizado." : "El inmueble quedó creado." });
      router.push("/admin");
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "No pudimos guardar el inmueble. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  }
  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setNotice(null);
    setIsUploading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("No se pudo conectar con Supabase.");
      const uploaded: string[] = [];
      for (const file of files) {
        if (!(file.type.startsWith("image/") || ["video/mp4", "video/webm", "video/quicktime"].includes(file.type))) {
          throw new Error(`${file.name}: usa una imagen o un video MP4, WebM o MOV.`);
        }
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} supera el máximo de 50 MB.`);
        const extension = file.name.split(".").pop()?.toLocaleLowerCase("es") || "bin";
        const path = `properties/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("property-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (error) throw error;
        uploaded.push(supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl);
      }
      setMedia(current => [...current, ...uploaded]);
      setNotice({ kind: "success", text: `${uploaded.length} archivo${uploaded.length === 1 ? "" : "s"} agregado${uploaded.length === 1 ? "" : "s"} a la galería.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudieron cargar los archivos." });
    } finally {
      setIsUploading(false);
    }
  }
  async function addType() {
    setTypeError("");
    const result = await createPropertyType(newType);
    if (!result.success) { setTypeError(result.error); return; }
    setTypes(current => [...current, { id: result.id, label: result.label }].sort((a, b) => a.label.localeCompare(b.label, "es")));
    field("type", result.label);
    setNewType("");
  }
  function addRemoteMedia() {
    try {
      const url = new URL(remoteUrl.trim());
      if (url.protocol !== "https:") throw new Error("El enlace debe comenzar con https://.");
      const markedUrl = remoteKind === "video" ? `${url.toString()}${url.hash ? "&" : "#"}media=video` : url.toString();
      setMedia(current => current.includes(markedUrl) ? current : [...current, markedUrl]);
      setRemoteUrl("");
      setNotice({ kind: "success", text: "El enlace quedó agregado a la galería." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Escribe un enlace HTTPS válido." });
    }
  }
  return <>
    <Link className="admin-cms-back" href="/admin"><ArrowLeft size={16}/> Volver al panel</Link>
    <div className="admin-page-title admin-cms-title"><div><div className="eyebrow"><span/> {initialData ? "ACTUALIZACIÓN" : "NUEVO REGISTRO"}</div><h1>{initialData ? "Editar inmueble" : "Agregar inmueble"}</h1><p>Completa la información para mantener actualizado el catálogo.</p></div></div>
    <form className="admin-cms-form" onSubmit={submit}>
      <section className="admin-cms-form-section"><h2>Información del inmueble</h2><div className="admin-cms-form-grid">
        <label className="admin-field admin-cms-span-2">Nombre o título<input required maxLength={160} value={form.title} onChange={e => field("title", e.target.value)} placeholder="Ej. Casa moderna en Carmen de Apicalá"/></label>
        <label className="admin-field">Tipo de inmueble<select value={form.type} onChange={e => field("type", e.target.value)}>{types.map(type => <option key={type.id} value={type.label}>{type.label}</option>)}{!types.some(type => type.label === form.type) && <option>{form.type}</option>}</select></label>
        <label className="admin-field">Estado comercial<select value={form.status} onChange={e => field("status", e.target.value as PropertyInput["status"])}><option>Disponible</option><option>En arriendo</option><option>Vendido</option><option>Oculto</option></select></label>
        <div className="admin-field admin-cms-span-2"><span>Agregar tipo de inmueble</span><div className="admin-cms-remote-media"><input value={newType} maxLength={50} onChange={e => setNewType(e.target.value)} placeholder="Ej. Casa campestre" aria-label="Nuevo tipo de inmueble"/><button type="button" className="button button-outline" onClick={() => void addType()} disabled={!newType.trim() || isSubmitting}><Plus size={15}/> Crear tipo</button></div>{typeError && <small className="admin-error" role="alert">{typeError}</small>}</div>
        <label className="admin-field">Precio (COP)<input required type="number" min="0" step="100000" value={form.price} onChange={e => field("price", Number(e.target.value))}/></label>
        <label className="admin-field">Área (m²)<input required type="number" min="0" step="0.01" value={form.area_sqm} onChange={e => field("area_sqm", Number(e.target.value))}/></label>
        <label className="admin-field">Habitaciones<input type="number" min="0" step="1" value={form.bedrooms} onChange={e => field("bedrooms", Number(e.target.value))}/></label>
        <label className="admin-field">Baños<input type="number" min="0" step="1" value={form.bathrooms} onChange={e => field("bathrooms", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Ubicación<input required value={form.location_text} onChange={e => field("location_text", e.target.value)} placeholder="Municipio, departamento"/></label>
        <label className="admin-field">Municipio<input value={form.municipality} onChange={e => field("municipality", e.target.value)} placeholder="Carmen de Apicalá"/></label>
        <label className="admin-field">Departamento / zona<input value={form.department} onChange={e => field("department", e.target.value)} placeholder="Tolima"/></label>
        <label className="admin-field admin-cms-span-2">Número predial / cédula catastral<input maxLength={50} value={form.cadastral_id} onChange={e => field("cadastral_id", e.target.value)} placeholder="Número nacional de 30 dígitos; el antiguo tiene 20"/><small>Croma busca por número predial nacional de 30 dígitos. Para números antiguos de 20 dígitos, la consulta usa las coordenadas; también puedes convertirlo al número nacional con el conversor del IGAC.</small></label>
        <label className="admin-field">Latitud<input type="number" step="any" value={form.lat} onChange={e => field("lat", Number(e.target.value))}/></label>
        <label className="admin-field">Longitud<input type="number" step="any" value={form.lng} onChange={e => field("lng", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Descripción<textarea rows={5} value={form.description} onChange={e => field("description", e.target.value)}/></label>
        <label className="admin-field">Características (una por línea)<textarea rows={5} value={form.features.join("\n")} onChange={e => field("features", e.target.value.split("\n").map(item => item.trim()).filter(Boolean))} placeholder={"Terraza privada\nConjunto cerrado"}/></label>
        <label className="admin-field">Plan de pagos (una por línea)<textarea rows={5} value={form.payment.join("\n")} onChange={e => field("payment", e.target.value.split("\n").map(item => item.trim()).filter(Boolean))} placeholder={"30% de cuota inicial\nPagos contra avance de obra"}/></label>
        <fieldset className="admin-field admin-cms-span-2"><legend>Categorías de búsqueda</legend><div className="admin-cms-category-options">{categoryOptions.map(category => <label key={category.id}><input type="checkbox" checked={form.categories.includes(category.id)} onChange={e => field("categories", e.target.checked ? [...form.categories, category.id] : form.categories.filter(item => item !== category.id))}/>{category.label}</label>)}</div><label className="admin-cms-featured"><input type="checkbox" checked={form.featured} onChange={e => field("featured", e.target.checked)}/> Destacar este inmueble en la portada</label></fieldset>
      </div></section>
      <section className="admin-cms-form-section">
        <h2>Ubicación e inteligencia territorial</h2>
        <OsmEnrichmentButton
          lat={form.lat}
          lng={form.lng}
          onAddressResolved={address => setForm(current => ({
            ...current,
            location_text: address.display_name || current.location_text,
            municipality: address.municipality || current.municipality,
            department: address.department || current.department,
          }))}
        />
      </section>
      <section className="admin-cms-media-editor"><div className="admin-cms-media-heading"><div><h2>Fotos y videos</h2><p>Sube archivos o pega enlaces públicos de Drive y otros sitios.</p></div><label className="button button-outline admin-cms-upload-button"><Upload size={15}/>{isUploading ? "Subiendo archivos…" : "Subir archivos"}<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple disabled={isUploading || isSubmitting} onChange={uploadFiles}/></label></div>
        {isUploading && <div className="admin-cms-upload-progress"><LoaderCircle size={15}/> Cargando los archivos seleccionados…</div>}
        <div className="admin-cms-remote-media"><select value={remoteKind} onChange={e => setRemoteKind(e.target.value as "image" | "video")} aria-label="Tipo de enlace"><option value="image">Foto</option><option value="video">Video</option></select><input type="url" value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" aria-label="Enlace de foto o video"/><button type="button" className="button button-outline" onClick={addRemoteMedia} disabled={!remoteUrl.trim()}><Link2 size={15}/> Agregar enlace</button></div>
        {media.length ? <div className="admin-cms-media-grid">{media.map((url, index) => {
          const isVideo = /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(url) || /[?#&](media|type)=video\b/i.test(url);
          return <div className="admin-cms-media-item" key={`${url}-${index}`}>{isVideo ? <video className="admin-cms-media-image" src={url} controls preload="metadata" playsInline aria-label={`Video ${index + 1}`}/> : <DriveImage className="admin-cms-media-image" src={url} alt={`Archivo ${index + 1}`}/>}<span className="admin-cms-media-kind">{isVideo ? <><Film size={12}/> Video</> : "Foto"}</span><button type="button" aria-label={`Quitar archivo ${index + 1}`} onClick={() => setMedia(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14}/></button></div>;
        })}</div> : <div className="admin-cms-media-empty"><ImagePlus size={20}/> Aún no hay fotos ni videos.</div>}
      </section>
      {notice && <div className={notice.kind === "success" ? "admin-success" : "admin-error"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
      <div className="admin-cms-form-footer"><Link className="button button-outline" href="/admin">Cancelar</Link><button className="button button-dark" disabled={isSubmitting}><Save size={16}/>{isSubmitting ? "Guardando…" : initialData ? "Guardar cambios" : "Crear inmueble"}</button></div>
    </form>
  </>;
}
