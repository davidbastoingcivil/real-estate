import Link from "next/link";
import { ArrowUpRight, Building2, Film, MapPin, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DriveImage from "@/components/DriveImage";
import PropertyRowActions from "./PropertyRowActions";

type PropertyRow = {
  id: number;
  title: string;
  price: number | string;
  type: string;
  area: number | string;
  bedrooms: number;
  bathrooms: number;
  location: string;
  status: string;
  is_published: boolean;
  created_at: string;
  images: string[] | null;
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("properties")
    .select("id,title,price,type,area,bedrooms,bathrooms,location,status,is_published,created_at,images")
    .order("created_at", { ascending: false });
  const properties = (data || []) as PropertyRow[];

  return <>
    <div className="admin-page-title admin-cms-title">
      <div><div className="eyebrow"><span/> CATÁLOGO INMOBILIARIO</div><h1>Panel principal</h1><p>Consulta y gestiona las propiedades conectadas a tu catálogo.</p></div>
      <Link className="button button-dark" href="/admin/properties/new"><Plus size={17}/> Nuevo inmueble</Link>
    </div>
    {error && <div className="admin-error" role="alert">No se pudo cargar el catálogo: {error.message}</div>}
    <div className="admin-cms-summary"><Building2 size={19}/><b>{properties.length}</b><span>{properties.length === 1 ? "inmueble registrado" : "inmuebles registrados"}</span></div>
    {properties.length ? <div className="admin-cms-list">
      {properties.map(property => {
        const status = !property.is_published ? "Oculto" : property.status.toLocaleLowerCase("es").includes("vendido") ? "Vendido" : "Disponible";
        return <article className="admin-cms-card" key={property.id}>
          <div className="admin-cms-photo">{property.images?.[0] && !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(property.images[0]) ? <DriveImage className="media-fill" src={property.images[0]} alt=""/> : property.images?.length ? <Film size={26}/> : <Building2 size={26}/>}</div>
          <div className="admin-cms-card-info">
            <div className="admin-cms-card-heading"><h2>{property.title}</h2><span className={`admin-cms-status ${status.toLowerCase()}`}>{status}</span></div>
            <div className="admin-cms-location"><MapPin size={14}/>{property.location}</div>
            <div className="admin-cms-metadata"><span>{property.type}</span><span>{Number(property.area)} m²</span><span>{property.bedrooms} hab.</span><span>{property.bathrooms} baños</span></div>
            <strong>{money.format(Number(property.price))}</strong>
          </div>
          <PropertyRowActions id={property.id} title={property.title}/>
        </article>;
      })}
    </div> : !error ? <section className="admin-cms-empty"><Building2 size={27}/><h2>Aún no hay inmuebles</h2><p>Cuando agregues una propiedad, aparecerá aquí junto con sus datos y estado.</p><Link className="button button-dark" href="/admin/properties/new"><Plus size={17}/> Crear primer inmueble</Link></section> : null}
    <Link className="admin-cms-public-link" href="/buscar">Ver catálogo público <ArrowUpRight size={15}/></Link>
  </>;
}
