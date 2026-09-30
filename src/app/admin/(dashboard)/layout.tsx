import Link from "next/link";
import { redirect } from "next/navigation";
import { Home, LayoutDashboard, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminSignOut from "@/components/admin/AdminSignOut";

export default async function AdminDashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/admin/login");

  return <div className="admin-workspace admin-cms">
    <aside className="admin-sidebar admin-cms-sidebar">
      <Link className="admin-logo" href="/"><span>DB</span><b>DAVID BASTO<br/><small>REAL ESTATE · ADMIN</small></b></Link>
      <div className="admin-side-label">PANEL DE CONTROL</div>
      <Link href="/admin" className="admin-cms-nav"><LayoutDashboard size={17}/> Panel principal</Link>
      <Link href="/admin/properties/new" className="admin-cms-nav"><Plus size={17}/> Nuevo inmueble</Link>
      <Link href="/admin/customize" className="admin-cms-nav"><Home size={17}/> Diseño del sitio</Link>
      <AdminSignOut />
    </aside>
    <div className="admin-cms-main">
      <header className="admin-topbar admin-cms-topbar"><div><span>Modo administrador</span><small>Los cambios se guardan en Supabase</small></div><AdminSignOut compact /></header>
      <main className="admin-cms-content">{children}</main>
      <nav className="admin-cms-mobile-nav" aria-label="Administración">
        <Link href="/admin"><LayoutDashboard size={18}/><span>Panel</span></Link>
        <Link href="/admin/properties/new"><Plus size={18}/><span>Nuevo</span></Link>
        <Link href="/admin/customize"><Home size={18}/><span>Diseño</span></Link>
        <AdminSignOut compact />
      </nav>
    </div>
  </div>;
}
