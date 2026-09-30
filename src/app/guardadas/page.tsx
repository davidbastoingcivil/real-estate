"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { usePropertyApp } from "@/components/AppProvider";
import PropertyCard from "@/components/PropertyCard";
export default function SavedPage(){const {favorites,allProperties,contentLoaded}=usePropertyApp();const saved=allProperties.filter(p=>favorites.includes(p.id));return <main className="app-page"><div className="app-page-heading"><div className="eyebrow"><span/> TU SELECCIÓN</div><h1>Propiedades <em>guardadas.</em></h1><p>Los espacios que te llamaron la atención, siempre a mano.</p></div>{saved.length?<div className="property-grid">{saved.map(p=><PropertyCard key={p.id} property={p}/>)}</div>:!contentLoaded?<div className="empty-state saved-empty"><b>Cargando tus propiedades…</b></div>:<div className="empty-state saved-empty"><Heart size={27}/><b>Aún no guardas propiedades</b><span>Toca el corazón de una propiedad y la encontrarás aquí.</span><Link className="button button-dark" href="/buscar">Explorar propiedades</Link></div>}</main>;}
