"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAdmin(identifier: string, password: string) {
  const username = process.env.ADMIN_USERNAME?.trim().toLocaleLowerCase("es");
  const adminEmail = process.env.ADMIN_LOGIN_EMAIL?.trim().toLocaleLowerCase("es");
  const normalizedIdentifier = identifier.trim().toLocaleLowerCase("es");

  if (!username || !adminEmail) {
    return { success: false, message: "Falta configurar el usuario administrador en el entorno del sitio." };
  }
  if (!password || (normalizedIdentifier !== username && normalizedIdentifier !== adminEmail)) {
    return { success: false, message: "Usuario o contraseña incorrectos." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
    if (error || !data.user) return { success: false, message: "Usuario o contraseña incorrectos." };

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      return { success: false, message: "La cuenta todavía no tiene permisos de administrador." };
    }

    return { success: true };
  } catch {
    return { success: false, message: "No se pudo conectar con Supabase. Inténtalo de nuevo." };
  }
}
