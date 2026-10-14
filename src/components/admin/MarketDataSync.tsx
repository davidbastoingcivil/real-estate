import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MarketDataSync() {
  const supabase = await createSupabaseServerClient();
  const [{ count, error: countError }, { data, error: dateError }] = await Promise.all([
    supabase.from("market_comparables").select("id", { count: "exact", head: true }),
    supabase.from("market_comparables").select("extraction_date").order("extraction_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const error = countError ?? dateError;
  return <section className="admin-cms-summary" aria-labelledby="market-data-title" style={{ display: "block", marginTop: 20 }}>
    <h2 id="market-data-title">Datos de mercado externos</h2>
    {error ? <p role="alert">No se pudieron consultar las métricas: {error.message}</p> : <dl style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div><dt>Comparables externos</dt><dd><strong>{count ?? 0}</strong></dd></div>
      <div><dt>Última extracción</dt><dd>{data?.extraction_date ? new Date(data.extraction_date).toLocaleString("es-CO") : "Sin registros"}</dd></div>
    </dl>}
    <p>La extracción se ejecuta fuera de Vercel mediante un proceso cron. Instale las dependencias de <code>scripts/scraper/requirements.txt</code>, configure las variables MARKET_URL_MERCADOLIBRE, MARKET_URL_FINCARAIZ, MARKET_URL_METROCUADRADO, MARKET_GEOCODE_CONTEXT, MARKET_CONTACT_EMAIL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno protegido del proceso y ejecute <code>python scripts/scraper/market_scraper.py</code>. Nunca configure la service role key en el navegador.</p>
  </section>;
}

