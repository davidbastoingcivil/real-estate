import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import ValuationReportDocument from "@/lib/pdf/ValuationReportDocument";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addReportImage, getGovernmentReportData } from "@/lib/pdf/governmentData";
import type { CadastralProperty } from "@/lib/pdf/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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

    const databaseRow = row as Record<string, unknown>;
    const property: CadastralProperty = {
      id: Number(databaseRow.id),
      title: String(databaseRow.title || "Inmueble sin título"),
      slug: String(databaseRow.slug || "inmueble"),
      description: typeof databaseRow.description === "string" ? databaseRow.description : null,
      price: Number(databaseRow.price) || 0,
      area: Number(databaseRow.area) || 0,
      type: String(databaseRow.type || "Inmueble"),
      location: String(databaseRow.location || "Ubicación no registrada"),
      municipality: typeof databaseRow.municipality === "string" ? databaseRow.municipality : null,
      department: typeof databaseRow.department === "string" ? databaseRow.department : typeof databaseRow["ubicación"] === "string" ? databaseRow["ubicación"] as string : null,
      cadastral_id: typeof databaseRow.cadastral_id === "string" ? databaseRow.cadastral_id : null,
      lat: Number(databaseRow.lat),
      lng: Number(databaseRow.lng),
      bedrooms: Number(databaseRow.bedrooms) || 0,
      bathrooms: Number(databaseRow.bathrooms) || 0,
      images: Array.isArray(databaseRow.images) ? databaseRow.images.filter((image): image is string => typeof image === "string") : [],
    };

    const report = await getGovernmentReportData(property, supabase);
    const reportWithImage = await addReportImage(report, property.images);
    const { data: { user } } = await supabase.auth.getUser();
    reportWithImage.metadata.requestedBy = user?.email || "Usuario de la plataforma";
    const document = createElement(ValuationReportDocument, { data: reportWithImage }) as unknown as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(document);
    const safeSlug = property.slug.replace(/[^a-z0-9-]/gi, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Informe-Predial-${safeSlug}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el informe predial.";
    return NextResponse.json({ error: message }, { status: message.includes("No se encontró") ? 404 : 503 });
  }
}
