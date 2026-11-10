#!/usr/bin/env node
import { createRequire } from "node:module";
import { buildStaticMap } from "../src/lib/pdf/staticMap.ts";

const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
loadEnvConfig(process.cwd());

const [latitude, longitude] = process.argv.slice(2).map(Number);
if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  console.error("Uso: node scripts/diagnose-map.mjs <latitud> <longitud>");
  process.exitCode = 1;
} else {
  const result = await buildStaticMap(latitude, longitude, []);
  const byteSummary = result.bytes === null ? "sin bytes de respuesta" : `${result.bytes} bytes`;
  const urlLengthSummary = result.urlLength === null ? "no disponible" : `${result.urlLength} caracteres`;
  const checks = {
    "a. Credencial": result.tokenType === "missing"
      ? "FALLA: falta MAPBOX_ACCESS_TOKEN en el servidor."
      : result.status === 401
        ? "FALLA: Mapbox respondió 401; token inválido o no autorizado."
        : result.status === 403
          ? "FALLA: Mapbox respondió 403; permisos o restricciones del token."
          : `Sin rechazo de credencial (${result.tokenType}; no se imprime el token).`,
    "b. Tamaño": result.reason?.includes("8 MB")
      ? `FALLA: ${result.reason}`
      : `Sin exceso confirmado (${byteSummary}).`,
    "c. Timeout/reintento": result.reason?.includes("10 segundos")
      ? `FALLA: ${result.reason} (${result.attempts} intentos).`
      : `Sin timeout confirmado (${result.attempts} intento(s), ${result.durationMs} ms).`,
    "d. Content-Length/Content-Type": result.contentType
      ? `${result.contentType.includes(";") ? "Incluye parámetros" : "Sin parámetros"}; tipo MIME validado por separado.`
      : "Sin content-type de respuesta para comprobar.",
    "e. Overlay/URL": result.overlaySyntaxValid
      ? `Sintaxis del overlay válida; longitud de URL ${urlLengthSummary}.`
      : `FALLA: sintaxis de overlay inválida; longitud de URL ${urlLengthSummary}.`,
  };
  console.log("Diagnóstico de mapa estático (no se imprimen URLs ni credenciales)");
  for (const [check, outcome] of Object.entries(checks)) console.log(`${check}: ${outcome}`);
  if (!result.image && result.reason) console.log(`Resultado: ${result.reason}`);
  if (!result.overlaySyntaxValid || result.urlLength !== null && result.urlLength > 8_192) process.exitCode = 1;
}
