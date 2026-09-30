import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileNav from "@/components/MobileNav";
import { AppProvider } from "@/components/AppProvider";
export const metadata: Metadata = { title: "David Basto Real Estate | Propiedades con propósito", description: "Encuentra tu próximo hogar o inversión inmobiliaria en Colombia con la asesoría de David Basto.", metadataBase: new URL("https://davidbastorealestate.vercel.app") };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body className="app-fonts"><AppProvider><Navbar/>{children}<Footer/><WhatsAppButton/><MobileNav/></AppProvider></body></html>; }
