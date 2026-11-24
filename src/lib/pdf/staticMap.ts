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
export type StaticMapProvider = "mapbox" | "esri" | "osm";
export type StaticMapResult = StaticMapFetchResult & {
  urlLength: number | null;
  overlaySyntaxValid: boolean;
  tokenType: "public" | "secret" | "unknown" | "missing";
  provider?: StaticMapProvider | null;
  attribution?: string | null;
  attemptsLog?: string[];
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

async function buildMapboxStaticMap(
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

// ---------------------------------------------------------------------------
// Tile-based fallback (no API key): Esri World Imagery (satellite) and
// OpenStreetMap standard tiles, composed server-side with sharp.
// ---------------------------------------------------------------------------

const TILE_SIZE = 256;
export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 456;

const tileProviders: Record<Exclude<StaticMapProvider, "mapbox">, { url: (z: number, x: number, y: number) => string; maxZoom: number; attribution: string; format: "jpeg" | "png" }> = {
  esri: {
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    maxZoom: 18,
    attribution: "Imagen satelital: Esri, Maxar, Earthstar Geographics y la comunidad GIS",
    format: "jpeg",
  },
  osm: {
    url: (z, x, y) => `${(process.env.NEXT_PUBLIC_OSM_TILE_URL?.trim() || "https://tile.openstreetmap.org/{z}/{x}/{y}.png").replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y))}`,
    maxZoom: 19,
    attribution: "© Colaboradores de OpenStreetMap (ODbL)",
    format: "png",
  },
};

const worldPixel = (lat: number, lng: number, zoom: number) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999);
  return {
    x: (lng + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const metersPerPixel = (lat: number, zoom: number) => 156_543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** zoom;

async function fetchTile(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "DavidBastoRealEstate/1.0 (property report map)", Accept: "image/png,image/jpeg,image/*" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok || !type.startsWith("image/")) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function overlaySvg(width: number, height: number, center: { x: number; y: number }, radiusPx: number, pois: Array<{ x: number; y: number }>) {
  const dots = pois.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="7" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5"/>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <circle cx="${center.x}" cy="${center.y}" r="${radiusPx.toFixed(1)}" fill="#10251d" fill-opacity="0.12" stroke="#d4af37" stroke-width="4" stroke-dasharray="14 8"/>
    ${dots}
    <circle cx="${center.x}" cy="${center.y}" r="17" fill="#d4af37" stroke="#10251d" stroke-width="5"/>
    <circle cx="${center.x}" cy="${center.y}" r="5" fill="#10251d"/>
  </svg>`);
}

export async function buildTileStaticMap(
  lat: number,
  lng: number,
  points: StaticMapPoint[],
  provider: Exclude<StaticMapProvider, "mapbox">,
  radiusMeters = 1_000,
): Promise<StaticMapResult> {
  const startedAt = Date.now();
  const config = tileProviders[provider];
  const base: StaticMapResult = {
    image: null, reason: null, status: null, contentType: null, bytes: null, durationMs: 0, attempts: 1,
    urlLength: null, overlaySyntaxValid: true, tokenType: "missing", provider, attribution: config.attribution,
  };
  // Largest zoom where the analysis radius still fits inside the frame.
  let zoom = config.maxZoom;
  while (zoom > 3 && radiusMeters / metersPerPixel(lat, zoom) > MAP_HEIGHT * 0.47) zoom -= 1;
  const radiusPx = radiusMeters / metersPerPixel(lat, zoom);
  const center = worldPixel(lat, lng, zoom);
  const left = Math.round(center.x - MAP_WIDTH / 2);
  const top = Math.round(center.y - MAP_HEIGHT / 2);
  const firstX = Math.floor(left / TILE_SIZE);
  const firstY = Math.floor(top / TILE_SIZE);
  const lastX = Math.floor((left + MAP_WIDTH - 1) / TILE_SIZE);
  const lastY = Math.floor((top + MAP_HEIGHT - 1) / TILE_SIZE);
  const maxIndex = 2 ** zoom;
  const jobs: Array<{ x: number; y: number }> = [];
  for (let ty = firstY; ty <= lastY; ty += 1) for (let tx = firstX; tx <= lastX; tx += 1) jobs.push({ x: tx, y: ty });

  try {
    const { default: sharp } = await import("sharp");
    const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
    let failures = 0;
    for (let index = 0; index < jobs.length; index += 6) {
      const batch = await Promise.allSettled(jobs.slice(index, index + 6).map(async job => {
        if (job.y < 0 || job.y >= maxIndex) throw new Error("fuera de rango");
        const wrappedX = ((job.x % maxIndex) + maxIndex) % maxIndex;
        const buffer = await fetchTile(config.url(zoom, wrappedX, job.y));
        return { input: buffer, left: (job.x - firstX) * TILE_SIZE, top: (job.y - firstY) * TILE_SIZE };
      }));
      for (const result of batch) {
        if (result.status === "fulfilled") tiles.push(result.value);
        else failures += 1;
      }
    }
    if (!tiles.length || failures > jobs.length / 3) {
      return { ...base, reason: `${provider === "esri" ? "Esri" : "OpenStreetMap"} no entregó suficientes teselas (${failures}/${jobs.length} fallidas).`, durationMs: Date.now() - startedAt };
    }
    const canvasWidth = (lastX - firstX + 1) * TILE_SIZE;
    const canvasHeight = (lastY - firstY + 1) * TILE_SIZE;
    const mosaic = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#dfe4df" } })
      .composite(tiles).png().toBuffer();
    const cropped = await sharp(mosaic).extract({ left: left - firstX * TILE_SIZE, top: top - firstY * TILE_SIZE, width: MAP_WIDTH, height: MAP_HEIGHT }).toBuffer();
    const poiPixels = points.slice(0, 25).map(point => {
      const pixel = worldPixel(point.lat, point.lng, zoom);
      return { x: pixel.x - left, y: pixel.y - top };
    }).filter(point => point.x >= 0 && point.x <= MAP_WIDTH && point.y >= 0 && point.y <= MAP_HEIGHT);
    const output = await sharp(cropped)
      .composite([{ input: overlaySvg(MAP_WIDTH, MAP_HEIGHT, { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }, radiusPx, poiPixels), left: 0, top: 0 }])
      .jpeg({ quality: 82 })
      .toBuffer();
    console.info("[static-map]", JSON.stringify({ provider, zoom, tiles: tiles.length, failures, bytes: output.byteLength, ms: Date.now() - startedAt }));
    return {
      ...base,
      image: `data:image/jpeg;base64,${output.toString("base64")}`,
      status: 200, contentType: "image/jpeg", bytes: output.byteLength, durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return { ...base, reason: `No se pudo componer el mapa (${provider}): ${error instanceof Error ? error.message : "error"}.`, durationMs: Date.now() - startedAt };
  }
}

/**
 * Report map with provider fallback:
 * Mapbox satellite (when MAPBOX_ACCESS_TOKEN is set) → Esri World Imagery → OpenStreetMap.
 */
export async function buildStaticMap(
  lat: number,
  lng: number,
  points: StaticMapPoint[],
  token = process.env.MAPBOX_ACCESS_TOKEN?.trim() || "",
): Promise<StaticMapResult> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
    return {
      image: null, reason: "El inmueble no tiene coordenadas válidas para el mapa.", status: null, contentType: null, bytes: null,
      durationMs: 0, attempts: 0, urlLength: null, overlaySyntaxValid: true, tokenType: token ? "unknown" : "missing", provider: null,
    };
  }
  const log: string[] = [];
  if (token) {
    const mapbox = await buildMapboxStaticMap(lat, lng, points, token);
    if (mapbox.image) return { ...mapbox, provider: "mapbox", attribution: "© Mapbox © OpenStreetMap", attemptsLog: log };
    log.push(`Mapbox: ${mapbox.reason}`);
  }
  for (const provider of ["esri", "osm"] as const) {
    const result = await buildTileStaticMap(lat, lng, points, provider);
    if (result.image) return { ...result, attemptsLog: log };
    log.push(result.reason || `${provider}: sin imagen`);
  }
  return {
    image: null, reason: log.join(" · ") || "Ningún proveedor de mapas respondió.", status: null, contentType: null, bytes: null,
    durationMs: 0, attempts: log.length, urlLength: null, overlaySyntaxValid: true, tokenType: token ? "unknown" : "missing", provider: null, attemptsLog: log,
  };
}
