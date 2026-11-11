export type StaticMapPoint = { lat: number; lng: number };
export type StaticMapFetchResult = {
  image: string | null;
  reason: string | null;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  durationMs: number;
  attempts: number;
};
export type StaticMapResult = StaticMapFetchResult & {
  urlLength: number | null;
  overlaySyntaxValid: boolean;
  tokenType: "public" | "secret" | "unknown" | "missing";
};

const maxImageBytes = 8_000_000;
const requestTimeoutMs = 10_000;
const maxStaticUrlLength = 1_800;

function encodePolyline(points: Array<[number, number]>) {
  let previousLat = 0;
  let previousLng = 0;
  let result = "";
  const encode = (value: number) => {
    let current = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (current >= 0x20) {
      chunk += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
      current >>= 5;
    }
    return chunk + String.fromCharCode(current + 63);
  };
  for (const [lng, lat] of points) {
    const scaledLat = Math.round(lat * 1e5);
    const scaledLng = Math.round(lng * 1e5);
    result += encode(scaledLat - previousLat) + encode(scaledLng - previousLng);
    previousLat = scaledLat;
    previousLng = scaledLng;
  }
  return result;
}

function staticMapUrl(
  lat: number,
  lng: number,
  points: StaticMapPoint[],
  token: string,
  includeRadius: boolean,
  size: "900x520@2x" | "1000x600",
) {
  const coordinate = (value: number) => Number(value.toFixed(6)).toString();
  const circle = includeRadius ? Array.from({ length: 25 }, (_, index) => {
    const angle = index / 24 * Math.PI * 2;
    const dLat = 1_000 / 111_320;
    const dLng = 1_000 / (111_320 * Math.max(Math.abs(Math.cos(lat * Math.PI / 180)), 0.1));
    return [lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)] as [number, number];
  }) : null;
  const encodedCircle = circle ? encodeURIComponent(encodePolyline(circle)).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`) : null;
  const radiusOverlay = encodedCircle ? `path-3+d4af37-0.9+10251d-0.15(${encodedCircle})` : null;
  const overlays = [
    `pin-l+d4af37(${coordinate(lng)},${coordinate(lat)})`,
    ...points.map(point => `pin-s+3b82f6(${coordinate(point.lng)},${coordinate(point.lat)})`),
    ...(radiusOverlay ? [radiusOverlay] : []),
  ].join(",");
  const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlays}/auto/${size}`);
  url.searchParams.set("access_token", token);
  return { url: url.toString(), overlaySyntaxValid: !radiusOverlay || /^path-3\+d4af37-0\.9\+10251d-0\.15\(.+\)$/.test(radiusOverlay) };
}

function failureReason(status: number | null, type: string | null) {
  if (status === 401) return "Mapbox rechazó la credencial (HTTP 401). Revisa el token del servidor.";
  if (status === 403) return "Mapbox denegó la solicitud (HTTP 403). Revisa permisos y restricciones del token.";
  if (status !== null) return `Mapbox respondió HTTP ${status}.`;
  if (type === "timeout") return "La solicitud a Mapbox excedió 10 segundos incluso tras un reintento.";
  if (type === "too-large") return "La imagen satelital superó el límite de 8 MB.";
  if (type === "content-type") return "Mapbox no devolvió una imagen PNG o JPEG.";
  return "No se pudo conectar con Mapbox desde el servidor.";
}

export async function fetchStaticMapImage(url: string): Promise<StaticMapFetchResult> {
  const startedAt = Date.now();
  let lastResult: StaticMapFetchResult = {
    image: null, reason: null, status: null, contentType: null, bytes: null, durationMs: 0, attempts: 0,
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptStartedAt = Date.now();
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      const contentType = response.headers.get("content-type") || "";
      const mediaType = contentType.split(";")[0].trim().toLowerCase();
      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
      if (!response.ok) {
        lastResult = {
          image: null, reason: failureReason(response.status, null), status: response.status,
          contentType: contentType || null, bytes: Number.isFinite(contentLength) ? contentLength : null,
          durationMs: Date.now() - attemptStartedAt, attempts: attempt,
        };
      } else if (Number.isFinite(contentLength) && contentLength !== null && contentLength > maxImageBytes) {
        lastResult = {
          image: null, reason: failureReason(response.status, "too-large"), status: response.status,
          contentType: contentType || null, bytes: contentLength,
          durationMs: Date.now() - attemptStartedAt, attempts: attempt,
        };
      } else if (!["image/png", "image/jpeg"].includes(mediaType)) {
        lastResult = {
          image: null, reason: failureReason(response.status, "content-type"), status: response.status,
          contentType: contentType || null, bytes: Number.isFinite(contentLength) ? contentLength : null,
          durationMs: Date.now() - attemptStartedAt, attempts: attempt,
        };
      } else {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > maxImageBytes) {
          lastResult = {
            image: null, reason: failureReason(response.status, "too-large"), status: response.status,
            contentType: contentType || null, bytes: bytes.byteLength,
            durationMs: Date.now() - attemptStartedAt, attempts: attempt,
          };
        } else {
          lastResult = {
            image: `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
            reason: null, status: response.status, contentType: contentType || null, bytes: bytes.byteLength,
            durationMs: Date.now() - attemptStartedAt, attempts: attempt,
          };
        }
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastResult = {
        image: null,
        reason: failureReason(null, timedOut ? "timeout" : "network"),
        status: null,
        contentType: null,
        bytes: null,
        durationMs: Date.now() - attemptStartedAt,
        attempts: attempt,
      };
    }

    console.info("[static-map]", JSON.stringify({
      status: lastResult.status,
      contentType: lastResult.contentType?.slice(0, 100) ?? null,
      bytes: lastResult.bytes,
      ms: lastResult.durationMs,
      attempt,
      outcome: lastResult.image ? "success" : lastResult.reason,
    }));
    if (lastResult.image || (lastResult.status !== null && lastResult.status < 500)) break;
  }

  return { ...lastResult, durationMs: Date.now() - startedAt };
}

export async function buildStaticMap(
  lat: number,
  lng: number,
  points: StaticMapPoint[],
  token = process.env.MAPBOX_ACCESS_TOKEN?.trim() || "",
): Promise<StaticMapResult> {
  const tokenType: StaticMapResult["tokenType"] = !token ? "missing" : token.startsWith("pk.") ? "public" : token.startsWith("sk.") ? "secret" : "unknown";
  const baseResult: StaticMapResult = {
    image: null,
    reason: null,
    status: null,
    contentType: null,
    bytes: null,
    durationMs: 0,
    attempts: 0,
    urlLength: null,
    overlaySyntaxValid: true,
    tokenType,
  };
  if (!token) {
    const reason = "MAPBOX_ACCESS_TOKEN no está configurado en el servidor.";
    console.warn("[static-map]", JSON.stringify({ outcome: "missing-token" }));
    return { ...baseResult, reason };
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    return { ...baseResult, reason: "El inmueble no tiene coordenadas válidas para el mapa." };
  }

  const nearest = points.slice(0, 10);
  let markerCount = nearest.length;
  let candidate = staticMapUrl(lat, lng, nearest, token, true, "900x520@2x");
  while (candidate.url.length > maxStaticUrlLength && markerCount > 0) {
    markerCount -= 1;
    candidate = staticMapUrl(lat, lng, nearest.slice(0, markerCount), token, true, "900x520@2x");
  }
  if (candidate.url.length > maxStaticUrlLength) {
    candidate = staticMapUrl(lat, lng, [], token, false, "900x520@2x");
  }
  if (candidate.url.length > maxStaticUrlLength) {
    return { ...baseResult, reason: "La URL del mapa supera el límite local de 1.800 caracteres.", urlLength: candidate.url.length };
  }

  let result = await fetchStaticMapImage(candidate.url);
  if (result.image) return { ...baseResult, ...result, urlLength: candidate.url.length, overlaySyntaxValid: candidate.overlaySyntaxValid };
  if (result.status === 401 || result.status === 403 || result.status === null) {
    return { ...baseResult, ...result, urlLength: candidate.url.length, overlaySyntaxValid: candidate.overlaySyntaxValid };
  }

  if (result.reason?.includes("superó el límite")) {
    candidate = staticMapUrl(lat, lng, nearest.slice(0, markerCount), token, true, "1000x600");
    result = await fetchStaticMapImage(candidate.url);
    if (result.image) return { ...baseResult, ...result, urlLength: candidate.url.length, overlaySyntaxValid: candidate.overlaySyntaxValid };
  }

  if (result.status !== null && result.status >= 400 && result.status < 500) {
    candidate = staticMapUrl(lat, lng, [], token, true, "1000x600");
    result = await fetchStaticMapImage(candidate.url);
    if (result.image) return { ...baseResult, ...result, urlLength: candidate.url.length, overlaySyntaxValid: candidate.overlaySyntaxValid };
    if (result.status !== 401 && result.status !== 403) {
      candidate = staticMapUrl(lat, lng, [], token, false, "1000x600");
      result = await fetchStaticMapImage(candidate.url);
      if (result.image) return { ...baseResult, ...result, urlLength: candidate.url.length, overlaySyntaxValid: candidate.overlaySyntaxValid };
    }
  }

  return {
    ...baseResult,
    ...result,
    reason: result.reason || "Mapbox no devolvió una imagen satelital.",
    urlLength: candidate.url.length,
    overlaySyntaxValid: candidate.overlaySyntaxValid,
  };
}
