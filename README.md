# David Basto Real Estate

Sitio inmobiliario creado con Next.js App Router, TypeScript, Tailwind CSS 4, Leaflet y React Leaflet.

Incluye búsqueda y filtros compartidos entre resultados y mapa, favoritos persistentes en el navegador, navegación móvil, perfiles y fichas de detalle. Las fichas aceptan galerías con fotos y videos; además integran una calculadora financiera y un formulario de contacto conectado con Supabase.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Para generar el paquete de producción ejecuta `npm run build` y luego `npm start`.

## Actualizar propiedades

Con Supabase conectado, administra los inmuebles desde `/admin`; no hace falta editar código para cambiar fichas. El catálogo público, los filtros, el mapa y la ficha detallada leen la misma tabla `public.properties`. Los tipos se mantienen relacionados en `public.property_types`; las imágenes, características, pagos, promoción en portada y publicación se guardan en la ficha tabular. `src/data/properties.ts` mantiene el catálogo de demostración que se puede importar desde el panel.

## Publicar en Vercel

Conecta en Vercel el repositorio Git que contiene este proyecto y deja la configuración detectada automáticamente para Next.js. La raíz del proyecto es esta carpeta y el comando de compilación es `npm run build`.

En **Settings → Environment Variables**, agrega estas dos variables para Production, Preview y Development:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

Usa los valores del proyecto Supabase activo. No subas `.env.local` al repositorio; ya está excluido por `.gitignore`. Después de agregar o cambiar variables, crea un nuevo deployment para que Next.js las incorpore. El mapa consulta PostGIS por límites y usa el basemap vectorial ArcGIS Dark Gray. Configura `NEXT_PUBLIC_ARCGIS_API_KEY` en `.env.local` y en Vercel. La clave se usa en el navegador para solicitar los basemaps: restríngela en ArcGIS a los dominios de producción y preview que realmente uses y habilita solo el privilegio **Basemaps**. Si falta la clave localmente, el mapa conserva un mapa OpenStreetMap de respaldo. La búsqueda de propiedades se limita al área visible y espera brevemente tras cada movimiento antes de llamar a Supabase.

El complemento actual de Esri declara compatibilidad con MapLibre GL 2–4, mientras que su módulo vectorial aún usa la importación `default` retirada en MapLibre 6. Esta app fija MapLibre GL 6.4.1 para incluir la corrección de seguridad y aplica una adaptación pequeña en `scripts/patch-esri-leaflet-vector.cjs` al instalar dependencias. `.npmrc` permite resolver el rango peer anterior. Verifica el mapa tras actualizar cualquiera de esos paquetes.

## Activar el administrador

El panel está en `/admin`. Usa `@supabase/ssr` para guardar y refrescar las sesiones en cookies; `src/proxy.ts` protege las rutas `/admin/*`, y el panel comprueba además que el usuario esté en la lista privada `admin_users`. Para habilitarlo, configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y en las variables de Vercel, ejecuta `supabase/schema.sql` en el SQL Editor de tu proyecto y crea la cuenta del encargado en Supabase Auth. En una base vacía, ejecuta luego `supabase/seed_properties.sql` para importar las 20 fichas iniciales; el script omite slugs que ya existan. Después, autoriza la cuenta desde el SQL Editor. El botón de estrella en cada ficha permite cambiar la propiedad destacada de la portada; solo puede existir una destacada al tiempo.

En Supabase, confirma que el Data API esté habilitado y que el esquema `public` esté expuesto. El SQL concede permisos mínimos para las tablas; RLS limita los datos y operaciones disponibles por tipo de usuario.

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('admin@tudominio.com')
on conflict (user_id) do nothing;
```

Usa el correo real del encargado. Las políticas de Row Level Security dejan públicas las fichas publicadas y las fotos, y reservan cambios, borrados y cargas a los usuarios de esa lista. Nunca pongas claves `service_role` o secretas en variables `NEXT_PUBLIC_`.

## Activar las funciones V2

Esta actualización **no reemplaza ni vuelve a crear** la tabla `public.properties`. La migración `supabase/migrations/20260930_v2_gallery_map_leads.sql` añade coordenadas PostGIS, búsqueda RPC por área y la tabla de leads. Revisa y ejecuta ese archivo una sola vez en el SQL Editor del proyecto existente. Activa PostGIS en el esquema `extensions` y Vault antes de la migración; la migración prepara `pg_net`. La columna geográfica se completa con los valores existentes de `lat` y `lng`.

El bucket público existente conserva el nombre `property-images`. En Supabase **Storage → Buckets → property-images → Edit bucket**, permite `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `video/mp4`, `video/webm` y `video/quicktime`, y fija el máximo en 25 MiB (también debe permitirlo el límite global del proyecto). La política de Storage sigue restringiendo las cargas al listado de administradores. Los enlaces de Drive añadidos desde el panel deben permitir visualización con enlace; al pegar un video selecciona el tipo “Video”.

Para activar el webhook, guarda la URL de producción de n8n en **Supabase Vault** con el nombre `n8n_webhook_url`. La función de trigger usa `pg_net` de forma asíncrona: guardar un lead no espera ni falla si n8n está temporalmente fuera de servicio. Aún no hace falta ninguna variable nueva en Vercel; la URL de n8n se mantiene en Vault, nunca en código ni en una variable pública. Expón `public.leads` en la Data API si tu proyecto no expone ese esquema automáticamente.

La calculadora ofrece una estimación de cuota con conversión de tasa efectiva anual a mes vencido y una aproximación de rentabilidad bruta y flujo mensual. No incluye costos de cierre, seguros, impuestos, administración, vacancia ni variaciones de tasa.

## Contacto

El número y la identidad comercial se editan en `/admin`, en la sección “Diseño del sitio”.
