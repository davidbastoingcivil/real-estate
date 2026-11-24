# Plan de intervención y actualización — David Basto Real Estate

Fecha: 24 de noviembre de 2026
Base: informe `Informe-Tecnico-Inversion-penthouse-panoramico-tunja.pdf` (DB-18-4BAB6153), código en `main` y datos de `public.properties` (proyecto Supabase `real state`).

---

## 1. Diagnóstico: por qué el informe sale con "Sin dato"

El informe se genera en `src/app/api/avm/pdf/route.ts` → `getGovernmentReportData()` (`src/lib/pdf/governmentData.ts`) → `ValuationReportDocument.tsx`. La integración con Croma (`api.croma.run`) **ya existe en el código**; los vacíos vienen de configuración y de datos, no de falta de integración.

| Síntoma en el PDF | Causa | Evidencia |
|---|---|---|
| Avalúo, áreas oficiales, destinación, NPN: "Sin dato" | `CROMA_API_KEY` probablemente no está en Vercel, o la consulta por punto devolvió `found:false` | `.env.example` la declara; el aviso "No se encontraron registros públicos…" aparece cuando la consulta responde sin predio |
| "Municipio · DIVIPOLA: Sin validar" y todo el bloque DANE "En validación territorial" | La ficha 18 tiene `municipality_code = NULL`; sin código no se consultan DANE ni estadísticas IGAC | 20 de 21 fichas tienen `municipality_code` nulo |
| Mapa: "MAPBOX_ACCESS_TOKEN no está configurado" | Falta la variable en Vercel | Texto literal del PDF |
| "La consulta a OpenStreetMap excedió el tiempo" | Overpass público con timeout de 8 s; la caché `property_geo_analytics` no estaba lista para la ficha 18 | `overpassClient.ts:125` |
| Página 5 en blanco con solo la franja de WhatsApp | El bloque de contacto se parte entre páginas (título en p. 4, texto en p. 5) | `ValuationReportDocument.tsx:301` sin `wrap={false}` |
| Pie de página "DB-18-4BAB6153 ·" sin número | `render` dentro de un `<Text>` anidado no lo evalúa react-pdf | `ValuationReportDocument.tsx:128` |
| Coordenadas "5.538000, -73.355000" | Coordenadas redondeadas (3 decimales ≈ ±100 m) → la consulta por punto cae en otro predio o en vía pública | Casi todas las fichas tienen 3–4 decimales |
| Precio $120.000.000 para penthouse de 250 m² → rentabilidad 20 % | Dato de la ficha probablemente mal digitado (¿$1.200.000.000?) | Ficha 18 |

### Datos inconsistentes encontrados en Supabase

| Id | Ficha | Problema |
|---|---|---|
| 1 | Condominio Bambú (Carmen de Apicalá) | `municipality_code = 50001` (Villavicencio). Carmen de Apicalá es **73148**. Además `cadastral_id` empieza en `25175` (Chía). El informe lanzará error 422 de validación |
| 15 | Cabaña Tunja | `municipality = "Chorro Blanco - rosa"` (vereda, no municipio) |
| 18 | Penthouse Tunja | Sin DIVIPOLA, sin NPN, precio dudoso |
| 21 | Apartamento Toberín | `cadastral_id` de 19 dígitos (inválido); `municipality = "Bogotá ciudad"` |
| 2–20 | Resto | Sin `municipality_code`, sin NPN, sin estrato |

Códigos DIVIPOLA a cargar: Bogotá D.C. **11001**, Tunja **15001**, Carmen de Apicalá **73148**.

---

## 2. Fase 0 — Configuración (inmediato, sin código)

1. **Vercel → Settings → Environment Variables** (Production, Preview, Development), tipo *Sensitive*:
   - `CROMA_API_KEY` = la clave `croma_live_…` (nunca en el repositorio ni con prefijo `NEXT_PUBLIC_`).
   - `MAPBOX_ACCESS_TOKEN` = token de servidor con scope `styles:tiles` / Static Images.
   - `OSM_CONTACT_EMAIL` y, si hay volumen, `OVERPASS_API_URL` a un servicio alterno (p. ej. `https://overpass.kumi.systems/api/interpreter`).
2. **Redeploy** después de guardar las variables.
3. **Rotar la clave de Croma** después de configurarla: se compartió en texto plano en un chat.
4. Verificar en *Runtime Logs* de Vercel las respuestas de Croma (`Croma respondió 401/403/404`).

## 3. Fase 1 — Saneamiento de datos (1–2 días)

1. Migración SQL que rellene `municipality_code` a partir de `municipality` (tabla de equivalencias DIVIPOLA) y corrija la ficha 1 (`73148`).
2. Restricción `CHECK (municipality_code ~ '^\d{5}$')` y `CHECK (national_cadastral_number ~ '^\d{30}$')`.
3. Reemplazar el campo de texto libre "Municipio" del admin por un selector (departamento → municipio) que llene el DIVIPOLA automáticamente.
4. Pedir coordenadas con ≥ 6 decimales; botón en el admin "Ubicar en mapa" (clic sobre el predio) en lugar de escribirlas.
5. Revisar precios atípicos: alerta en el admin si $/m² está fuera de ±50 % de la mediana de la zona (ficha 18: $480.000/m²).

## 4. Fase 2 — Datos verdaderos con Croma (3–5 días)

Objetivo: que cada ficha tenga datos oficiales **guardados**, no consultados en vivo cada vez que alguien descarga un PDF.

1. **Tabla `property_official_data`** (property_id, payload jsonb, cadastral_number, appraisal, built_area, land_area, economic_destination, municipality_code, source, checked_at, status).
2. **Botón "Consultar Croma" en el admin** (`/api/admin/croma/sync`, solo `admin_users`):
   - Busca por NPN de 30 dígitos; si no hay, por coordenadas.
   - Muestra el resultado al administrador para **confirmar** que el predio corresponde antes de guardarlo (evita asignar el lote vecino).
   - Rellena NPN, DIVIPOLA, áreas oficiales y avalúo catastral.
3. **Sincronización DANE/IGAC municipal** una vez por municipio (tabla `municipal_indicators`), no por informe.
4. El PDF lee solo de Supabase → informe en < 3 s, sin timeouts, y con fecha de corte de la fuente.
5. Conversión de número predial antiguo (20 dígitos) a NPN de 30 si Croma lo expone; si no, aviso en el admin.
6. Manejo de errores visible: estado por ficha (`verificado`, `pendiente`, `no encontrado`, `conflicto`) en la tabla del admin.

## 5. Fase 3 — Corrección del PDF (1–2 días)

1. Pie de página: usar `<Text render={…} fixed/>` independiente para "Página X / Y".
2. `wrap={false}` en el bloque de contacto y en cada tabla corta; eliminar la página en blanco.
3. Portada: mostrar "Preparado para" solo con el nombre normalizado (capitalizado) y validar nombres de prueba.
4. Ficha técnica: cuando no hay dato oficial, mostrar el dato de la ficha con la etiqueta "Declarado por el vendedor" en vez de "Sin dato".
5. Mapa: si no hay Mapbox, generar mapa con teselas OSM/Esri en el servidor como respaldo.
6. Sección financiera: agregar administración, predial (a partir del avalúo catastral y la tarifa municipal), seguros y vacancia → rentabilidad neta y no solo bruta.
7. Sección de mercado: comparables de `market_comparables` (ya existe la migración) con $/m² mediano de la zona.
8. Unificar los dos generadores (`/api/properties/[slug]/pdf` y `/api/avm/pdf`): hoy hay dos plantillas y dos fórmulas de cuota duplicadas.
9. Guardar cada informe emitido (`report_id`, lead, hash) para trazabilidad y para enviarlo por WhatsApp/n8n.

## 6. Fase 4 — Mejoras de producto (2–3 semanas)

- **Riesgos**: integrar capas de amenaza (remoción en masa / inundación) del SGC o del POT municipal cuando estén disponibles.
- **POT**: tabla manual por municipio (uso, tratamiento, altura) mientras no exista una fuente API.
- **Leads**: el formulario del informe ya pide WhatsApp; enviar el PDF automáticamente al lead y notificar al asesor.
- **SEO**: metadatos y Open Graph por ficha, `sitemap.xml`, datos estructurados `RealEstateListing`.
- **Rendimiento**: imágenes vía `next/image` y Supabase transform; caché ISR en fichas publicadas.
- **Seguridad**: revisar advisors de Supabase, limitar la generación de PDF por IP (rate limit) porque cada informe consume créditos de Croma.
- **Calidad**: pruebas de las funciones financieras y de validación NPN/DIVIPOLA; CI con `npm run lint` y `next build` en cada PR.

## 7. Orden recomendado

| # | Tarea | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | Variables en Vercel + redeploy + rotar clave | 15 min | Alto |
| 2 | DIVIPOLA en todas las fichas + corregir ficha 1 | 1 h | Alto |
| 3 | Página en blanco y número de página del PDF | 1 h | Medio |
| 4 | Sincronización Croma desde el admin + tabla de datos oficiales | 3–5 días | Muy alto |
| 5 | Coordenadas precisas con selector de mapa | 1 día | Alto |
| 6 | Unificar generadores PDF y agregar rentabilidad neta | 2 días | Medio |
| 7 | Comparables, POT, riesgos, SEO | 2–3 semanas | Medio |
