import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./theme-app.css";
import "./theme-luxe.css";
import "./motion.css";
import "./admin-theme.css";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileNav from "@/components/MobileNav";
import { AppProvider } from "@/components/AppProvider";
import MotionEffects from "@/components/MotionEffects";
import { themeInitScript } from "@/components/ThemeToggle";

// Visual theme only: the app font is exposed as --font-app for theme-app.css.
const appFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-app", display: "swap" });
// Display serif used for headings in the dark (luxury) theme.
const displayFont = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });
export const metadata: Metadata = { title: "David Basto Real Estate | Propiedades con propósito", description: "Encuentra tu próximo hogar o inversión inmobiliaria en Colombia con la asesoría de David Basto.", metadataBase: new URL("https://davidbastorealestate.vercel.app") };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f6f4" }, { media: "(prefers-color-scheme: dark)", color: "#0b111c" }] };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es" data-theme="dark" className={`${appFont.variable} ${displayFont.variable}`} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }}/></head><body className="app-fonts"><AppProvider><MotionEffects/><Navbar/>{children}<Footer/><WhatsAppButton/><MobileNav/></AppProvider></body></html>; }
