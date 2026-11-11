"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, ImagePlus, Link2, LoaderCircle, Save, Trash2, Upload, Plus } from "lucide-react";
import { createProperty, createPropertyType, updateProperty, type PropertyInput } from "@/app/admin/(dashboard)/actions";
import type { AudioTour, ProjectDossier, VideoPresentation } from "@/data/properties";
import { getSupabaseClient } from "@/lib/supabase/client";
import DriveImage from "@/components/DriveImage";
import OsmEnrichmentButton from "@/components/admin/OsmEnrichmentButton";

export type PropertyFormData = PropertyInput & { id: number };
export type PropertyTypeOption = { id: string; label: string };

const empty: Omit<PropertyFormData, "id"> = {
  title: "", description: "", price: 0, property_code: "", periodicity: "Único", type: "Casa", area_sqm: 0,
  bedrooms: 0, bathrooms: 0, garage_spaces: 0, location_text: "", status: "Disponible", lat: 4.1472, lng: -74.7201,
  cadastral_id: "", chip: "", national_cadastral_number: "", real_estate_registration: "", stratum: null,
  cadastral_appraisal: null, official_lot_area: null, official_built_area: null, deposits: 0,
  municipality: "", municipality_code: "", department: "", features: [], categories: ["Buy"], payment: [], featured: false, images: [], audio_tours: [], video_presentations: [], dossier: {},
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
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [media, setMedia] = useState<string[]>(initialData?.images || []);
  const [audioTours, setAudioTours] = useState<AudioTour[]>(initialData?.audio_tours || []);
  const [videoPresentations, setVideoPresentations] = useState<VideoPresentation[]>(initialData?.video_presentations || []);
  const [dossierText, setDossierText] = useState(JSON.stringify(initialData?.dossier || {}, null, 2));
  const [types, setTypes] = useState(propertyTypes.length ? propertyTypes : defaultPropertyTypes);
  const [newType, setNewType] = useState("");
  const [typeError, setTypeError] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteKind, setRemoteKind] = useState<"image" | "video" | "audio">("image");
  const [isUploading, setIsUploading] = useState(false);
  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      let dossier: ProjectDossier;
      try {
        const parsed: unknown = JSON.parse(dossierText || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        dossier = parsed as ProjectDossier;
      } catch { setNotice({ kind: "error", text: "La ficha del proyecto debe ser un objeto JSON válido." }); setIsSubmitting(false); return; }
      const payload: PropertyInput = { ...form, images: media, audio_tours: audioTours, video_presentations: videoPresentations, dossier };
      const result = initialData ? await updateProperty(initialData.id, payload) : await createProperty(payload);
      if (!result.success) {
        setNotice({ kind: "error", text: result.error });
        return;
      }
      if (result.warning) {
        setNotice({ kind: "warning", text: result.warning });
        router.refresh();
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
      const uploadedAudio: AudioTour[] = [];
      const uploadedVideo: VideoPresentation[] = [];
      for (const file of files) {
        const isAudio = ["audio/mpeg", "audio/mp3"].includes(file.type) || /\.mp3$/i.test(file.name);
        const isVideo = file.type === "video/mp4" || /\.mp4$/i.test(file.name);
        if (!(file.type.startsWith("image/") || isVideo || isAudio)) {
          throw new Error(`${file.name}: usa una imagen, video MP4 o audio MP3.`);
        }
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} supera el máximo de 50 MB.`);
        const extension = file.name.split(".").pop()?.toLocaleLowerCase("es") || "bin";
        const path = `properties/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("property-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (error) throw error;
        const url = supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl;
        if (isAudio) uploadedAudio.push({ title: file.name.replace(/\.mp3$/i, ""), url });
        else if (isVideo) uploadedVideo.push({ title: file.name.replace(/\.(mp4|webm|mov)$/i, ""), url });
        else uploaded.push(url);
      }
      setMedia(current => [...current, ...uploaded]);
      setAudioTours(current => [...current, ...uploadedAudio]);
      setVideoPresentations(current => [...current, ...uploadedVideo]);
      setNotice({ kind: "success", text: `${uploaded.length + uploadedAudio.length + uploadedVideo.length} archivo${uploaded.length + uploadedAudio.length + uploadedVideo.length === 1 ? "" : "s"} agregado${uploaded.length + uploadedAudio.length + uploadedVideo.length === 1 ? "" : "s"}.` });
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
      if (remoteKind === "audio") setAudioTours(current => current.some(item => item.url === url.toString()) ? current : [...current, { title: "Audio de asesoría", url: url.toString() }]);
      else if (remoteKind === "video") setVideoPresentations(current => current.some(item => item.url === url.toString()) ? current : [...current, { title: "Presentación del proyecto", url: url.toString() }]);
      else setMedia(current => current.includes(url.toString()) ? current : [...current, url.toString()]);
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
        <label className="admin-field">Código de inmueble<input maxLength={40} value={form.property_code} onChange={e => field("property_code", e.target.value.toUpperCase())} placeholder="DBRE-00001"/></label>
        <label className="admin-field">Periodicidad del precio<select value={form.periodicity} onChange={e => field("periodicity", e.target.value as PropertyInput["periodicity"])}><option value="Único">Precio total</option><option value="Mensual">Canon mensual</option></select></label>
        <div className="admin-field admin-cms-span-2"><span>Agregar tipo de inmueble</span><div className="admin-cms-remote-media"><input value={newType} maxLength={50} onChange={e => setNewType(e.target.value)} placeholder="Ej. Casa campestre" aria-label="Nuevo tipo de inmueble"/><button type="button" className="button button-outline" onClick={() => void addType()} disabled={!newType.trim() || isSubmitting}><Plus size={15}/> Crear tipo</button></div>{typeError && <small className="admin-error" role="alert">{typeError}</small>}</div>
        <label className="admin-field">Precio (COP)<input required type="number" min="0" step="100000" value={form.price} onChange={e => field("price", Number(e.target.value))}/></label>
        <label className="admin-field">Área (m²)<input required type="number" min="0" step="0.01" value={form.area_sqm} onChange={e => field("area_sqm", Number(e.target.value))}/></label>
        <label className="admin-field">Habitaciones<input type="number" min="0" step="1" value={form.bedrooms} onChange={e => field("bedrooms", Number(e.target.value))}/></label>
        <label className="admin-field">Baños<input type="number" min="0" step="1" value={form.bathrooms} onChange={e => field("bathrooms", Number(e.target.value))}/></label>
        <label className="admin-field">Garajes<input type="number" min="0" step="1" value={form.garage_spaces} onChange={e => field("garage_spaces", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Ubicación<input required value={form.location_text} onChange={e => field("location_text", e.target.value)} placeholder="Municipio, departamento"/></label>
        <label className="admin-field">Municipio<input value={form.municipality} onChange={e => field("municipality", e.target.value)} placeholder="Carmen de Apicalá"/></label>
        <label className="admin-field">Código DIVIPOLA del municipio<input inputMode="numeric" maxLength={5} value={form.municipality_code} onChange={e => field("municipality_code", e.target.value.replace(/\D/g, "").slice(0,5))} placeholder="73148"/><small>Necesario para validar el prefijo municipal del Número Predial Nacional.</small></label>
        <label className="admin-field">Departamento / zona<input value={form.department} onChange={e => field("department", e.target.value)} placeholder="Tolima"/></label>
        <label className="admin-field admin-cms-span-2">Número predial / cédula catastral<input maxLength={50} value={form.cadastral_id} onChange={e => field("cadastral_id", e.target.value)} placeholder="Número nacional de 30 dígitos; el antiguo tiene 20"/><small>Croma busca por número predial nacional de 30 dígitos. Para números antiguos de 20 dígitos, la consulta usa las coordenadas; también puedes convertirlo al número nacional con el conversor del IGAC.</small></label>
        <label className="admin-field">CHIP<input maxLength={11} value={form.chip} onChange={e => field("chip", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="AAA0000AAAA"/><small>Formato de 11 caracteres asignado por Catastro Bogotá.</small></label>
        <label className="admin-field">Número Predial Nacional<input inputMode="numeric" maxLength={30} value={form.national_cadastral_number} onChange={e => field("national_cadastral_number", e.target.value.replace(/\D/g, "").slice(0,30))} placeholder="30 dígitos"/><small>Si lo registras, debe tener exactamente 30 dígitos.</small></label>
        <label className="admin-field">Matrícula inmobiliaria<input maxLength={40} value={form.real_estate_registration} onChange={e => field("real_estate_registration", e.target.value)} placeholder="Número según certificado"/></label>
        <label className="admin-field">Estrato individual<select value={form.stratum ?? ""} onChange={e => field("stratum", e.target.value === "" ? null : Number(e.target.value))}><option value="">Sin dato</option>{[0,1,2,3,4,5,6].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="admin-field">Depósitos<input type="number" min="0" step="1" value={form.deposits} onChange={e => field("deposits", Number(e.target.value))}/></label>
        <label className="admin-field">Avalúo catastral oficial (COP)<input type="number" min="0" step="1" value={form.cadastral_appraisal ?? ""} onChange={e => field("cadastral_appraisal", e.target.value === "" ? null : Number(e.target.value))}/></label>
        <label className="admin-field">Área terreno oficial (m²)<input type="number" min="0" step="0.01" value={form.official_lot_area ?? ""} onChange={e => field("official_lot_area", e.target.value === "" ? null : Number(e.target.value))}/></label>
        <label className="admin-field">Área construida oficial (m²)<input type="number" min="0" step="0.01" value={form.official_built_area ?? ""} onChange={e => field("official_built_area", e.target.value === "" ? null : Number(e.target.value))}/></label>
        <label className="admin-field">Latitud<input type="number" step="any" value={form.lat} onChange={e => field("lat", Number(e.target.value))}/></label>
        <label className="admin-field">Longitud<input type="number" step="any" value={form.lng} onChange={e => field("lng", Number(e.target.value))}/></label>
        <label className="admin-field admin-cms-span-2">Descripción<textarea rows={5} value={form.description} onChange={e => field("description", e.target.value)}/></label>
        <label className="admin-field">Características (una por línea)<textarea rows={5} value={form.features.join("\n")} onChange={e => field("features", e.target.value.split("\n").map(item => item.trim()).filter(Boolean))} placeholder={"Terraza privada\nConjunto cerrado"}/></label>
        <label className="admin-field">Plan de pagos (una por línea)<textarea rows={5} value={form.payment.join("\n")} onChange={e => field("payment", e.target.value.split("\n").map(item => item.trim()).filter(Boolean))} placeholder={"30% de cuota inicial\nPagos contra avance de obra"}/></label>
        <label className="admin-field admin-cms-span-2">Ficha comercial para el dossier personalizado (JSON)<textarea rows={12} spellCheck={false} value={dossierText} onChange={event=>setDossierText(event.target.value)} placeholder={'{"developer":"Nombre del constructor","tagline":"Una frase del proyecto","description":"Descripción","brochurePrice":390000000,"travelTime":"2 h 30 desde Bogotá","sections":[{"title":"Nivel 1","description":"Descripción del nivel","items":["Sala y comedor","Cocina"]}]}'}/><small>Este contenido alimenta la página técnica del PDF. Cada proyecto puede definir sus propios títulos, niveles, espacios y acabados.</small></label>
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
      <section className="admin-cms-media-editor"><div className="admin-cms-media-heading"><div><h2>Fotos, videos y audios</h2><p>Sube imágenes, MP4 o MP3. Los videos se reproducen solo cuando el usuario los inicia.</p></div><label className="button button-outline admin-cms-upload-button"><Upload size={15}/>{isUploading ? "Subiendo archivos…" : "Subir archivos"}<input type="file" accept="image/*,video/mp4,audio/mpeg,audio/mp3,.mp3" multiple disabled={isUploading || isSubmitting} onChange={uploadFiles}/></label></div>
        {isUploading && <div className="admin-cms-upload-progress"><LoaderCircle size={15}/> Cargando los archivos seleccionados…</div>}
        <div className="admin-cms-remote-media"><select value={remoteKind} onChange={e => setRemoteKind(e.target.value as "image" | "video" | "audio")} aria-label="Tipo de enlace"><option value="image">Foto</option><option value="video">Video</option><option value="audio">Audio MP3</option></select><input type="url" value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://…" aria-label="Enlace de foto, video o audio"/><button type="button" className="button button-outline" onClick={addRemoteMedia} disabled={!remoteUrl.trim()}><Link2 size={15}/> Agregar enlace</button></div>
        {media.length ? <div className="admin-cms-media-grid">{media.map((url, index) => {
          const isVideo = /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(url) || /[?#&](media|type)=video\b/i.test(url);
          return <div className="admin-cms-media-item" key={`${url}-${index}`}>{isVideo ? <video className="admin-cms-media-image" src={url} controls preload="metadata" playsInline aria-label={`Video ${index + 1}`}/> : <DriveImage className="admin-cms-media-image" src={url} alt={`Archivo ${index + 1}`}/>}<span className="admin-cms-media-kind">{isVideo ? <><Film size={12}/> Video</> : "Foto"}</span><button type="button" aria-label={`Quitar archivo ${index + 1}`} onClick={() => setMedia(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14}/></button></div>;
        })}</div> : <div className="admin-cms-media-empty"><ImagePlus size={20}/> Aún no hay fotos ni videos.</div>}
        {(videoPresentations.length > 0 || audioTours.length > 0) && <div className="admin-cms-media-details">
          {videoPresentations.map((item,index)=><div className="admin-cms-media-detail" key={`video-${item.url}`}><Film size={15}/><input aria-label={`Título del video ${index+1}`} value={item.title} onChange={event=>setVideoPresentations(current=>current.map((entry,i)=>i===index?{...entry,title:event.target.value}:entry))}/><button type="button" aria-label="Quitar video" onClick={()=>setVideoPresentations(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button><small>MP4</small></div>)}
          {audioTours.map((item,index)=><div className="admin-cms-media-detail" key={`audio-${item.url}`}><span className="admin-audio-mark">MP3</span><input aria-label={`Título del audio ${index+1}`} value={item.title} onChange={event=>setAudioTours(current=>current.map((entry,i)=>i===index?{...entry,title:event.target.value}:entry))}/><input aria-label={`Duración del audio ${index+1}`} placeholder="Duración opcional" value={item.duration || ""} onChange={event=>setAudioTours(current=>current.map((entry,i)=>i===index?{...entry,duration:event.target.value}:entry))}/><button type="button" aria-label="Quitar audio" onClick={()=>setAudioTours(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}
        </div>}
      </section>
      {notice && <div className={notice.kind === "success" ? "admin-success" : "admin-error"} role={notice.kind === "error" || notice.kind === "warning" ? "alert" : "status"}>{notice.text}</div>}
      <div className="admin-cms-form-footer"><Link className="button button-outline" href="/admin">Cancelar</Link><button className="button button-dark" disabled={isSubmitting}><Save size={16}/>{isSubmitting ? "Guardando…" : initialData ? "Guardar cambios" : "Crear inmueble"}</button></div>
    </form>
  </>;
}
