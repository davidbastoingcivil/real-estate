"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LeadResult = { success: true } | { success: false; error: string };

export async function createLead(input: { name: string; phone_number: string; interested_property_id?: number; website?: string }): Promise<LeadResult> {
  try {
    if (input.website?.trim()) return { success: true };
    const name = input.name.trim().replace(/\s+/g, " ");
    const phone = input.phone_number.replace(/[^\d+]/g, "");
    const digits = phone.replace(/\D/g, "");
    if (name.length < 2 || name.length > 100) throw new Error("Escribe un nombre válido.");
    if (digits.length < 7 || digits.length > 15) throw new Error("Escribe un número de teléfono válido.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("leads").insert({
      name,
      phone_number: phone,
      interested_property_id: Number.isSafeInteger(input.interested_property_id) ? input.interested_property_id : null,
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No pudimos enviar tu solicitud. Inténtalo de nuevo." };
  }
}
