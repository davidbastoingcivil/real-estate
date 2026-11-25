import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./theme-app.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileNav from "@/components/MobileNav";
import { AppProvider } from "@/components/AppProvider";

// Visual theme only: the app font is exposed as --font-app for theme-app.css.
const appFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-app", display: "swap" });
export const metadata: Metadata = { title: "David Basto Real Estate | Propiedades con propósito", description: "Encuentra tu próximo hogar o inversión inmobiliaria en Colombia con la asesoría de David Basto.", metadataBase: new URL("https://davidbastorealestate.vercel.app") };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0e5a43" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body className={`app-fonts ${appFont.variable}`}><AppProvider><Navbar/>{children}<Footer/><WhatsAppButton/><MobileNav/></AppProvider></body></html>; }
