"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LeadResult = { success: true } | { success: false; error: string };

export async function createLead(input: { name: string; phone_number: string; interested_property_id?: number; website?: string; lead_type?: "property_inquiry" | "sell_property" | "rent_property"; details?: string; consent_accepted?: boolean }): Promise<LeadResult> {
  try {
    if (input.website?.trim()) return { success: true };
    if (input.consent_accepted !== true) throw new Error("Acepta el uso de datos para que podamos responder tu solicitud.");
    const name = input.name.trim().replace(/\s+/g, " ");
    const phone = input.phone_number.replace(/[^\d+]/g, "");
    const digits = phone.replace(/\D/g, "");
    if (name.length < 2 || name.length > 100) throw new Error("Escribe un nombre válido.");
    if (digits.length < 7 || digits.length > 15) throw new Error("Escribe un número de teléfono válido.");
    const leadType = input.lead_type || "property_inquiry";
    if (!["property_inquiry", "sell_property", "rent_property"].includes(leadType)) throw new Error("El tipo de solicitud no es válido.");
    const details = (input.details || "").trim().slice(0, 2000);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("leads").insert({
      name,
      phone_number: phone,
      interested_property_id: Number.isSafeInteger(input.interested_property_id) ? input.interested_property_id : null,
      lead_type: leadType,
      details,
      consent_accepted: true,
      consent_version: "2026-11-06",
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No pudimos enviar tu solicitud. Inténtalo de nuevo." };
  }
}
