# David Basto Real Estate

Sitio inmobiliario creado con Next.js App Router, TypeScript, Tailwind CSS 4, Leaflet y React Leaflet.

Incluye búsqueda y filtros compartidos entre resultados y mapa, favoritos persistentes en el navegador, navegación móvil, perfiles y fichas de detalle. El contacto abre una conversación directa por WhatsApp; no requiere cuenta de usuario ni guarda datos personales en un backend.

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

Usa los valores del proyecto Supabase activo. No subas `.env.local` al repositorio; ya está excluido por `.gitignore`. Después de agregar o cambiar variables, crea un nuevo deployment para que Next.js las incorpore. El mapa carga mosaicos públicos de OpenStreetMap y requiere conexión a internet en el navegador.

## Activar el administrador

El panel está en `/admin`. Usa `@supabase/ssr` para guardar y refrescar las sesiones en cookies; `src/proxy.ts` protege las rutas `/admin/*`, y el panel comprueba además que el usuario esté en la lista privada `admin_users`. Para habilitarlo, configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y en las variables de Vercel, ejecuta `supabase/schema.sql` en el SQL Editor de tu proyecto y crea la cuenta del encargado en Supabase Auth. En una base vacía, ejecuta luego `supabase/seed_properties.sql` para importar las 20 fichas iniciales; el script omite slugs que ya existan. Después, autoriza la cuenta desde el SQL Editor. El botón de estrella en cada ficha permite cambiar la propiedad destacada de la portada; solo puede existir una destacada al tiempo.

En Supabase, confirma que el Data API esté habilitado y que el esquema `public` esté expuesto. El SQL concede permisos mínimos para las tablas; RLS limita los datos y operaciones disponibles por tipo de usuario.

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('admin@tudominio.com')
on conflict (user_id) do nothing;
```

Usa el correo real del encargado. Las políticas de Row Level Security dejan públicas las fichas publicadas y las fotos, y reservan cambios, borrados y cargas a los usuarios de esa lista. Nunca pongas claves `service_role` o secretas en variables `NEXT_PUBLIC_`.

## Contacto

El número y la identidad comercial se editan en `/admin`, en la sección “Diseño del sitio”.
