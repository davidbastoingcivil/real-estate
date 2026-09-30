"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminSignOut({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function signOut() {
    await getSupabaseClient()?.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return <button type="button" className={compact ? "admin-cms-signout compact" : "admin-signout admin-cms-signout"} onClick={() => void signOut()}>
    <LogOut size={17}/><span>{compact ? "Salir" : "Cerrar sesión"}</span>
  </button>;
}
