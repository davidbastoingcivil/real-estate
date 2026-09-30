"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, Search, UserRound } from "lucide-react";
const items = [{ href: "/", label: "Inicio", icon: House }, { href: "/buscar", label: "Buscar", icon: Search }, { href: "/guardadas", label: "Guardados", icon: Heart }, { href: "/perfil", label: "Perfil", icon: UserRound }];
export default function MobileNav() { const path = usePathname(); return <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">{items.map(({ href, label, icon: Icon }) => <Link href={href} key={href} aria-current={path === href ? "page" : undefined} className={path === href ? "active" : ""}><Icon size={19}/><span>{label}</span></Link>)}</nav>; }
