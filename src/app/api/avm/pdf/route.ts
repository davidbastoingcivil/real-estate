import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import ValuationReportDocument from "@/lib/pdf/ValuationReportDocument";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addReportImage, CadastralValidationError, getGovernmentReportData } from "@/lib/pdf/governmentData";
import type { CadastralProperty } from "@/lib/pdf/types";
import type { CadastralReportData } from "@/lib/pdf/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function cadastralProperty(databaseRow: Record<string, unknown>): CadastralProperty {
  const optionalNumber = (value: unknown) => value === null || value === undefined || value === "" ? null : Number(value);
  return {
    id: Number(databaseRow.id), title: String(databaseRow.title || "Inmueble sin título"), slug: String(databaseRow.slug || "inmueble"),
    description: typeof databaseRow.description === "string" ? databaseRow.description : null,
    price: Number(databaseRow.price) || 0, area: Number(databaseRow.area) || 0, type: String(databaseRow.type || "Inmueble"),
    location: String(databaseRow.location || "Ubicación no registrada"), municipality: typeof databaseRow.municipality === "string" ? databaseRow.municipality : null,
    municipality_code: typeof databaseRow.municipality_code === "string" ? databaseRow.municipality_code : null,
    department: typeof databaseRow.department === "string" ? databaseRow.department : typeof databaseRow["ubicación"] === "string" ? databaseRow["ubicación"] as string : null,
    cadastral_id: typeof databaseRow.national_cadastral_number === "string" ? databaseRow.national_cadastral_number : typeof databaseRow.cadastral_id === "string" ? databaseRow.cadastral_id : null,
    chip: typeof databaseRow.chip === "string" ? databaseRow.chip : null,
    national_cadastral_number: typeof databaseRow.national_cadastral_number === "string" ? databaseRow.national_cadastral_number : null,
    real_estate_registration: typeof databaseRow.real_estate_registration === "string" ? databaseRow.real_estate_registration : null,
    stratum: optionalNumber(databaseRow.stratum), cadastral_appraisal: optionalNumber(databaseRow.cadastral_appraisal),
    official_lot_area: optionalNumber(databaseRow.official_lot_area), official_built_area: optionalNumber(databaseRow.official_built_area),
    garage_spaces: Number(databaseRow.garage_spaces) || 0, deposits: Number(databaseRow.deposits) || 0,
    dossier: databaseRow.dossier && typeof databaseRow.dossier === "object" ? databaseRow.dossier as CadastralProperty["dossier"] : null,
    lat: Number(databaseRow.lat), lng: Number(databaseRow.lng), bedrooms: Number(databaseRow.bedrooms) || 0, bathrooms: Number(databaseRow.bathrooms) || 0,
    images: Array.isArray(databaseRow.images) ? databaseRow.images.filter((image): image is string => typeof image === "string") : [],
  };
}

async function renderReport(property: CadastralProperty, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, financialSimulation: CadastralReportData["financialSimulation"], client: CadastralReportData["client"]) {
  const report = await getGovernmentReportData(property, supabase);
  const reportWithImage = await addReportImage(report, property.images);
  reportWithImage.client = client;
  reportWithImage.financialSimulation = financialSimulation;
  const document = createElement(ValuationReportDocument, { data: reportWithImage }) as unknown as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(document);
  const safeSlug = property.slug.replace(/[^a-z0-9-]/gi, "-");
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Informe-Tecnico-Inversion-${safeSlug}.pdf"`,
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  }});
}

function monthlyPayment(principal: number, annualRate: number, years: number) {
  const months = years * 12;
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  return monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { propertyId?: unknown; clientName?: unknown; clientWhatsApp?: unknown; consentAccepted?: unknown; financialSimulation?: Record<string, unknown> };
    const id = Number(body.propertyId);
    const name = typeof body.clientName === "string" ? body.clientName.trim().replace(/\s+/g, " ") : "";
    const phone = typeof body.clientWhatsApp === "string" ? body.clientWhatsApp.replace(/\D/g, "") : "";
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Selecciona un inmueble registrado para consultar sus datos reales." }, { status: 400 });
    if (name.length < 2 || name.length > 100 || phone.length < 7 || phone.length > 15 || body.consentAccepted !== true) return NextResponse.json({ error: "Completa nombre, WhatsApp y autorización para generar el informe." }, { status: 400 });
    const values = body.financialSimulation;
    const percent = Number(values?.porcentajeCuotaInicial);
    const annualRate = Number(values?.tasaEfectivaAnual);
    const years = Number(values?.plazoAnos);
    const rent = Number(values?.arriendoEstimado || 0);
    if (![percent, annualRate, years, rent].every(Number.isFinite) || percent < 0 || percent > 100 || annualRate < 0 || annualRate > 40 || years < 1 || years > 40 || rent < 0 || rent > 500000000) {
      return NextResponse.json({ error: "Los valores financieros están fuera del rango permitido." }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase.from("properties").select("*").eq("id", id).eq("is_published", true).maybeSingle();
    if (error) throw new Error(`No se pudo consultar el inmueble: ${error.message}`);
    if (!row) return NextResponse.json({ error: "No se encontró un inmueble publicado con ese identificador." }, { status: 404 });
    const property = cadastralProperty(row as Record<string, unknown>);
    const price = property.price;
    const downPayment = price * percent / 100;
    const financed = Math.max(0, price - downPayment);
    const payment = monthlyPayment(financed, annualRate, years);
    const simulation: NonNullable<CadastralReportData["financialSimulation"]> = {
      propertyValue: price, downPaymentPercent: percent, downPaymentValue: downPayment, financedCapital: financed,
      annualEffectiveRate: annualRate, termYears: years, monthlyPayment: payment, estimatedRent: rent,
      grossAnnualYield: price > 0 ? rent * 12 / price * 100 : 0, monthlyCashFlow: rent - payment,
    };
    return await renderReport(property, supabase, simulation, { name, whatsapp: phone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el informe técnico.";
    const status = error instanceof CadastralValidationError ? 422 : message.includes("No se encontró") ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedPropertyId = params.get("property_id");
  const valuationId = params.get("valuationId");
  if (!requestedPropertyId && !valuationId) {
    return NextResponse.json({ error: "Indica property_id o un valuationId guardado por un administrador." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    let propertyId = requestedPropertyId;
    let isAdminValuationRequest = false;

    if (valuationId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Inicia sesión como administrador para descargar este informe." }, { status: 401 });
      const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!admin) return NextResponse.json({ error: "Solo un administrador puede descargar informes guardados." }, { status: 403 });
      const { data: saved, error: savedError } = await supabase.from("property_valuations").select("property_id").eq("id", valuationId).maybeSingle();
      if (savedError || !saved?.property_id) return NextResponse.json({ error: "No se encontró el inmueble asociado al informe guardado." }, { status: 404 });
      propertyId = String(saved.property_id);
      isAdminValuationRequest = true;
    }

    const id = Number(propertyId);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "property_id debe ser válido." }, { status: 400 });
    let query = supabase.from("properties").select("*").eq("id", id);
    if (!isAdminValuationRequest) query = query.eq("is_published", true);
    const { data: row, error } = await query.maybeSingle();
    if (error) throw new Error(`No se pudo consultar el inmueble: ${error.message}`);
    if (!row) return NextResponse.json({ error: "No se encontró un inmueble disponible con ese identificador." }, { status: 404 });

    const property = cadastralProperty(row as Record<string, unknown>);
    return await renderReport(property, supabase, null, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el informe predial.";
    const status = error instanceof CadastralValidationError ? 422 : message.includes("No se encontró") ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
