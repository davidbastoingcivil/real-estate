"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePropertyApp } from "@/components/AppProvider";
export default function Navbar() {
  const { settings } = usePropertyApp(); const digits = settings.whatsappPhone.replace(/\D/g, "");
  return <header className="nav"><Link className="brand" href="/" aria-label={`${settings.brandName} ${settings.brandSubtitle}`}><span className="brand-mark">{settings.brandMark}</span><span className="brand-copy"><b>{settings.brandName.toUpperCase()}</b><small>{settings.brandSubtitle.toUpperCase()}</small></span></Link><nav><a href="/#propiedades">Propiedades</a><a href="/#mapa">Explorar mapa</a><a href="/#sobre-mi">Sobre David</a></nav><a className="nav-cta" href={`https://wa.me/${digits}?text=Hola%2C%20quiero%20asesor%C3%ADa%20inmobiliaria`} target="_blank" rel="noreferrer">Agenda una asesoría <ArrowUpRight size={15}/></a><a className="mobile-cta" href={`https://wa.me/${digits}`} aria-label="Contactar"><ArrowUpRight size={18}/></a></header>;
}
