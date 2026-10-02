"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { signInAdmin } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await signInAdmin(String(form.get("identifier") ?? ""), String(form.get("password") ?? ""));
      if (!result.success) {
        setMessage(result.message ?? "No se pudo iniciar sesión. Revisa tus datos e inténtalo otra vez.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    });
  }

  return <main className="admin-login-page">
    <section className="admin-login-card">
      <div className="admin-lock"><KeyRound size={20}/></div>
      <span className="eyebrow">DAVID BASTO · REAL ESTATE</span>
      <h1>Acceso administrador</h1>
      <p>Ingresa con tu usuario autorizado para gestionar propiedades y la presentación del sitio.</p>
      {message && <div className="admin-error" role="alert">{message}</div>}
      <form onSubmit={submit}>
        <label htmlFor="identifier">Usuario o correo</label>
        <input id="identifier" name="identifier" autoComplete="username" required placeholder="Usuario administrador"/>
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required/>
        <button className="button button-dark" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={15} className="spin"/> Verificando…</> : "Ingresar al panel"}</button>
      </form>
      <small>El acceso está protegido por Supabase Auth y la lista de administradores autorizados.</small>
    </section>
  </main>;
}
