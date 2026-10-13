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
    if (error || !data.user) {
      if (error?.code === "email_not_confirmed") {
        return { success: false, message: "La cuenta de Supabase todavía no está confirmada. Confírmala desde Auth antes de ingresar." };
      }
      if (error?.code === "invalid_credentials") {
        return { success: false, message: "Supabase Auth rechazó los datos. Usa la contraseña vigente de la cuenta asociada al correo administrador; el nombre de usuario solo sirve como alias." };
      }
      return { success: false, message: "No se pudo autenticar con Supabase. Revisa la conexión del proyecto y vuelve a intentarlo." };
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      return { success: false, message: adminError
        ? "Supabase inició sesión, pero no se pudo validar el acceso en admin_users. Revisa la tabla y su política de lectura."
        : "La cuenta inició sesión, pero aún no aparece en la lista admin_users." };
    }

    return { success: true };
  } catch {
    return { success: false, message: "No se pudo conectar con Supabase. Inténtalo de nuevo." };
  }
}
