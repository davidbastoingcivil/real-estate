import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { properties, type Property } from "@/data/properties";
import { propertyFromDatabase, type PropertyDatabaseRow } from "@/lib/supabase/properties";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InvestmentDossierDocument, { type InvestmentDossierData } from "@/lib/pdf/InvestmentDossierDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RequestBody = {
  clientName?: unknown;
  clientWhatsApp?: unknown;
  consentAccepted?: unknown;
  simulation?: {
    cuotaInicial?: unknown;
    tasaInteres?: unknown;
    plazoAnos?: unknown;
    arriendoMensual?: unknown;
  };
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function monthlyPayment(principal: number, annualRate: number, years: number) {
  const months = years * 12;
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  return monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

async function findProperty(slug: string): Promise<Property | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("properties").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
    if (error) throw error;
    if (data) return propertyFromDatabase(data as unknown as PropertyDatabaseRow);
  } catch (error) {
    console.error("No se pudo consultar la ficha publicada para el dossier.", error instanceof Error ? error.message : "Supabase no disponible");
  }
  return properties.find(item => item.slug === slug || item.id === slug || (item.id === "bambu" && slug.toLowerCase().includes("bambu"))) || null;
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = await request.json() as RequestBody;
    const name = typeof body.clientName === "string" ? body.clientName.trim().replace(/\s+/g, " ") : "";
    const phone = typeof body.clientWhatsApp === "string" ? body.clientWhatsApp.trim() : "";
    const phoneDigits = phone.replace(/\D/g, "");
    const simulation = body.simulation;

    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Escribe un nombre válido para personalizar el dossier." }, { status: 400 });
    if (phoneDigits.length < 7 || phoneDigits.length > 15) return NextResponse.json({ error: "Escribe un número de WhatsApp válido." }, { status: 400 });
    if (body.consentAccepted !== true) return NextResponse.json({ error: "Debes aceptar el uso de los datos para generar el dossier." }, { status: 400 });
    if (!simulation || !finite(simulation.cuotaInicial) || !finite(simulation.tasaInteres) || !finite(simulation.plazoAnos)) {
      return NextResponse.json({ error: "No se recibieron los datos completos de la simulación." }, { status: 400 });
    }
    if (simulation.cuotaInicial < 0 || simulation.tasaInteres < 0 || simulation.tasaInteres > 40 || simulation.plazoAnos < 1 || simulation.plazoAnos > 40) {
      return NextResponse.json({ error: "Los valores de la simulación están fuera del rango permitido." }, { status: 400 });
    }
    if (simulation.arriendoMensual !== undefined && (!finite(simulation.arriendoMensual) || simulation.arriendoMensual < 0 || simulation.arriendoMensual > 500000000)) {
      return NextResponse.json({ error: "El valor del arriendo estimado no es válido." }, { status: 400 });
    }

    const property = await findProperty(slug);
    if (!property) return NextResponse.json({ error: "No encontramos un proyecto publicado para generar el dossier." }, { status: 404 });
    if (property.price <= 0 || simulation.cuotaInicial > property.price) return NextResponse.json({ error: "La cuota inicial debe ser menor o igual al valor del inmueble." }, { status: 400 });

    const financedCapital = Math.max(0, property.price - simulation.cuotaInicial);
    const payment = monthlyPayment(financedCapital, simulation.tasaInteres, simulation.plazoAnos);
    if (![financedCapital, payment].every(Number.isFinite)) return NextResponse.json({ error: "No pudimos calcular este escenario financiero." }, { status: 400 });
    const monthlyRent = typeof simulation.arriendoMensual === "number" ? simulation.arriendoMensual : 0;
    const data: InvestmentDossierData = {
      generatedAt: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date()),
      client: { name, whatsapp: phoneDigits },
      advisor: { name: "David Basto", role: "Ing. Civil · Asesor inmobiliario", phone: "573125372457" },
      property: {
        id: property.id,
        slug: property.slug,
        title: property.name,
        code: property.code || `DBRE-${(property.databaseId || 0).toString().padStart(5, "0")}`,
        type: property.type,
        operation: property.status,
        location: property.location,
        price: property.price,
        periodicity: property.periodicity || (property.status === "En arriendo" ? "Mensual" : "Único"),
        area: property.area,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        garages: property.garages || 0,
        description: property.description,
      },
      dossier: property.dossier || {},
      simulation: {
        downPayment: simulation.cuotaInicial,
        downPaymentPercent: property.price > 0 ? simulation.cuotaInicial / property.price * 100 : 0,
        annualRate: simulation.tasaInteres,
        termYears: simulation.plazoAnos,
        financedCapital,
        monthlyPayment: payment,
        monthlyRent,
        grossYield: property.price > 0 ? monthlyRent * 12 / property.price * 100 : 0,
        cashFlow: monthlyRent - payment,
      },
    };

    const document = createElement(InvestmentDossierDocument, { data }) as unknown as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(document);
    const fileSlug = property.slug.replace(/[^a-z0-9-]/gi, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Dossier-${fileSlug}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("No se pudo generar el dossier personalizado.", error instanceof Error ? error.message : "Error inesperado");
    return NextResponse.json({ error: "No pudimos generar el PDF en este momento. Inténtalo de nuevo." }, { status: 500 });
  }
}
