import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import ValuationReportDocument from "@/lib/pdf/ValuationReportDocument";
import { calculatePropertyValuation } from "@/lib/avm/valuationEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCoverImage(images: string[]) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return null;
  let allowedHost: string;
  try { allowedHost = new URL(configuredUrl).host; } catch { return null; }
  const imageUrl = images.find(value => !/\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(value));
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl);
    const isSupabaseImage = parsed.protocol === "https:" && parsed.host === allowedHost
      && parsed.pathname.startsWith("/storage/v1/object/public/property-images/");
    const isUnsplashImage = parsed.protocol === "https:" && parsed.host === "images.unsplash.com";
    if (!isSupabaseImage && !isUnsplashImage) return null;
    const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(2500), cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !/^image\/(jpeg|png)$/i.test(contentType) || length > 5_000_000) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5_000_000) return null;
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const propertyId = params.get("property_id");
  const valuationId = params.get("valuationId");
  if (!propertyId && !valuationId) {
    return NextResponse.json({ error: "Indica property_id o un valuationId guardado por un administrador." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    let valuation;
    if (valuationId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Inicia sesión como administrador para descargar un informe guardado." }, { status: 401 });
      const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!admin) return NextResponse.json({ error: "Solo un administrador puede descargar informes guardados." }, { status: 403 });
      const { data, error } = await supabase.from("property_valuations").select("valuation_data_json").eq("id", valuationId).maybeSingle();
      if (error || !data?.valuation_data_json) return NextResponse.json({ error: "No se encontró la estimación guardada." }, { status: 404 });
      valuation = data.valuation_data_json;
    } else {
      const id = Number(propertyId);
      if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "property_id debe ser válido." }, { status: 400 });
      valuation = await calculatePropertyValuation(supabase, id);
    }

    const code = valuationId?.slice(0, 8).toUpperCase() || `AVM-${valuation.property.id}-${new Date(valuation.valuation_date).toISOString().slice(0, 10).replaceAll("-", "")}`;
    const coverImage = await getCoverImage(valuation.property.images || []);
    const document = createElement(ValuationReportDocument, { data: valuation, code, coverImage }) as unknown as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(document);
    const safeSlug = String(valuation.property.slug || "inmueble").replace(/[^a-z0-9-]/gi, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Estimacion-AVM-${safeSlug}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el informe PDF.";
    return NextResponse.json({ error: message }, { status: message.includes("No se encontró") ? 404 : 503 });
  }
}
