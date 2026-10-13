import { NextResponse } from "next/server";
import { calculatePropertyValuation, savePropertyValuation } from "@/lib/avm/valuationEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { property_id?: string | number; persist?: boolean };
  try {
    body = await request.json() as { property_id?: string | number; persist?: boolean };
  } catch {
    return NextResponse.json({ error: "Envía un cuerpo JSON válido." }, { status: 400 });
  }
  const propertyId = Number(body.property_id);
  if (!Number.isSafeInteger(propertyId) || propertyId < 1) {
    return NextResponse.json({ error: "property_id debe ser un identificador válido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const valuation = await calculatePropertyValuation(supabase, propertyId);
    const { data: { user } } = await supabase.auth.getUser();
    let valuationId: string | null = null;
    let isAdmin = false;
    if (user) {
      const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      isAdmin = Boolean(admin);
      if (admin && body.persist === true) valuationId = await savePropertyValuation(supabase, valuation, user.id);
    }
    return NextResponse.json({ ...valuation, valuation_id: valuationId, is_admin: isAdmin }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo calcular la estimación.";
    return NextResponse.json({ error: message }, { status: message.includes("No se encontró") ? 404 : 503 });
  }
}
