// Parser for Catastro Bogotá (UAECD) parcel exports:
// - IDECA "Lote / predio" download (semicolon separated, one row per land use)
// - Datos abiertos "Predio.csv" (raw column names such as PRECHIP, PRECLASE…)
// Only the fields that matter for a property report are kept.

export type BogotaUse = { use: string; code: string | null; areaM2: number | null };
export type BogotaParcel = {
  chip: string;
  cadastralId: string | null;
  nationalCadastralNumber: string | null;
  officialAddress: string | null;
  additionalAddress: string | null;
  neighbourhood: string | null;
  neighbourhoodCode: string | null;
  blockCode: string | null;
  lotAreaM2: number | null;
  builtAreaM2: number | null;
  parcelType: string | null;
  parcelClass: string | null;
  economicDestination: string | null;
  horizontalProperty: string | null;
  housingUse: string | null;
  uses: BogotaUse[];
  constructionYear: number | null;
  ageYears: number | null;
  formationYear: number | null;
  updateYear: number | null;
  incorporationDate: string | null;
  physicalHomogeneousZone: string | null;
  qualificationScore: number | null;
  qualification: Record<string, string>;
};

type Field = Exclude<keyof BogotaParcel, "chip" | "uses" | "qualification" | "ageYears"> | "chip" | "use" | "useCode" | "useArea" | "age";

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Matchers tolerate accents lost to a wrong encoding ("Cdigo", "rea").
const has = (n: string, ...parts: string[]) => parts.some(part => n.includes(part));
function fieldFor(header: string): Field | null {
  const n = norm(header);
  if (!n) return null;
  if (n === "chip" || has(n, "codigochip", "cdigochip") || n === "prechip") return "chip";
  if (has(n, "cedulacatastral", "cdulacatastral") || n === "precedcata") return "cadastralId";
  if (has(n, "predialnacional") || n === "npn" || n === "prenupre") return "nationalCadastralNumber";
  if (has(n, "direccionoficial", "direccinoficial") || n === "predirecc") return "officialAddress";
  if (has(n, "direccionadicional", "direccinadicional")) return "additionalAddress";
  if (has(n, "nombrebarrio", "nombredelbarrio") || n === "prenbarrio") return "neighbourhood";
  if (has(n, "codigobarrio", "cdigobarrio") || n === "precbarrio") return "neighbourhoodCode";
  if (has(n, "codigomanzana", "cdigomanzana") || n === "premanzana") return "blockCode";
  if (has(n, "areadeuso", "readeuso", "areauso")) return "useArea";
  if ((has(n, "terreno") && has(n, "area", "rea")) || n === "preaterre") return "lotAreaM2";
  if ((has(n, "construida", "construccion", "construccin") && has(n, "area", "rea") && !has(n, "codigo", "cdigo")) || n === "preaconst") return "builtAreaM2";
  if (has(n, "tipodepredio", "tipopredio") || n === "pretipo") return "parcelType";
  if (has(n, "clasedepredio", "clasepredio") || n === "preclase") return "parcelClass";
  if (has(n, "destinoeconomico", "destinoeconmico") || n === "precdestin" || n === "predestino") return "economicDestination";
  if (has(n, "codigouso", "cdigouso") || n === "precuso") return "useCode";
  if (n === "usodelpredio" || n === "uso" || has(n, "descripcionuso", "descripcinuso", "nombreuso")) return "use";
  if (has(n, "propiedadhorizontal") || n === "preusoph") return "horizontalProperty";
  if (has(n, "usodevivienda", "usovivienda")) return "housingUse";
  if (has(n, "antiguedad", "antigedad", "vetustez") || n === "prevetustz") return "age";
  if (has(n, "vigencia") && has(n, "formacion", "formacin")) return "formationYear";
  if (has(n, "vigencia") && has(n, "actualizacion", "actualizacin")) return "updateYear";
  if (has(n, "incorporacion", "incorporacin")) return "incorporationDate";
  if (has(n, "zonahomogeneafisica", "zonahomognea", "zhf")) return "physicalHomogeneousZone";
  if (has(n, "puntaje")) return "qualificationScore";
  return null;
}

const qualificationKeys: Array<[string, string[]]> = [
  ["Estructura", ["estructura", "armazon", "armazn"]],
  ["Muros", ["muros"]],
  ["Cubierta", ["cubierta"]],
  ["Fachada", ["fachada"]],
  ["Acabados", ["acabado"]],
  ["Pisos", ["pisos"]],
  ["Cubrimiento muros", ["cubrimiento"]],
  ["Baño", ["bano", "bao"]],
  ["Cocina", ["cocina"]],
  ["Conservación", ["conservacion", "conservacin"]],
];

function qualificationKey(header: string) {
  const n = norm(header);
  return qualificationKeys.find(([, parts]) => has(n, ...parts))?.[0] ?? null;
}

/** RFC-4180 style parser with auto-detected ';' or ',' delimiter. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") === -1 ? undefined : clean.indexOf("\n"));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

const text = (value: string | undefined) => value && value.trim() ? value.trim() : null;
const digits = (value: string | undefined) => (value || "").replace(/\D/g, "") || null;
function decimal(value: string | undefined) {
  const raw = (value || "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") && raw.includes(".")
    ? (raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""))
    : raw.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
const year = (value: string | undefined) => {
  const number = decimal(value);
  return number !== null && number >= 1800 && number <= 2100 ? Math.round(number) : null;
};

export function parseBogotaCadastralCsv(content: string): BogotaParcel[] {
  const rows = parseDelimited(content);
  if (rows.length < 2) throw new Error("El archivo no tiene filas de datos.");
  const headers = rows[0];
  const fields = headers.map(fieldFor);
  const qualification = headers.map(qualificationKey);
  if (!fields.includes("chip")) throw new Error("No se encontró la columna CHIP. Usa la descarga de Catastro Bogotá (IDECA) o Predio.csv.");

  const parcels = new Map<string, BogotaParcel>();
  const currentYear = new Date().getFullYear();
  for (const row of rows.slice(1)) {
    const get = (field: Field) => {
      const index = fields.indexOf(field);
      return index === -1 ? undefined : row[index];
    };
    const chip = (get("chip") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!chip) continue;
    let parcel = parcels.get(chip);
    if (!parcel) {
      const ageRaw = decimal(get("age"));
      const constructionYear = ageRaw !== null && ageRaw >= 1800 ? Math.round(ageRaw) : null;
      const npn = digits(get("nationalCadastralNumber"));
      const quality: Record<string, string> = {};
      qualification.forEach((key, index) => {
        if (key && fields[index] === null && row[index]?.trim() && !quality[key]) quality[key] = row[index].trim();
      });
      parcel = {
        chip,
        cadastralId: text(get("cadastralId")),
        nationalCadastralNumber: npn && npn.length === 30 ? npn : null,
        officialAddress: text(get("officialAddress")),
        additionalAddress: text(get("additionalAddress")),
        neighbourhood: text(get("neighbourhood")),
        neighbourhoodCode: text(get("neighbourhoodCode")),
        blockCode: text(get("blockCode")),
        lotAreaM2: decimal(get("lotAreaM2")),
        builtAreaM2: decimal(get("builtAreaM2")),
        parcelType: text(get("parcelType")),
        parcelClass: text(get("parcelClass")),
        economicDestination: text(get("economicDestination")),
        horizontalProperty: text(get("horizontalProperty")),
        housingUse: text(get("housingUse")),
        uses: [],
        constructionYear,
        ageYears: constructionYear !== null ? currentYear - constructionYear : ageRaw,
        formationYear: year(get("formationYear")),
        updateYear: year(get("updateYear")),
        incorporationDate: text(get("incorporationDate")),
        physicalHomogeneousZone: text(get("physicalHomogeneousZone")),
        qualificationScore: decimal(get("qualificationScore")),
        qualification: quality,
      };
      parcels.set(chip, parcel);
    }
    const use = text(get("use"));
    const useCode = text(get("useCode"));
    if (use || useCode) {
      const entry = { use: use || `Uso ${useCode}`, code: useCode, areaM2: decimal(get("useArea")) };
      if (!parcel.uses.some(item => item.use === entry.use && item.areaM2 === entry.areaM2)) parcel.uses.push(entry);
    }
    // Rows of the same CHIP can differ per use (e.g. one use inside PH).
    for (const key of ["horizontalProperty", "housingUse"] as const) {
      const value = text(get(key));
      if (value && !(parcel[key] || "").split(" / ").includes(value)) parcel[key] = parcel[key] ? `${parcel[key]} / ${value}` : value;
    }
  }
  if (!parcels.size) throw new Error("El archivo no contiene CHIP válidos.");
  return [...parcels.values()];
}

export const isBogotaChip = (value: string | null | undefined) => /^[A-Z]{3}\d{4}[A-Z]{4}$/.test((value || "").toUpperCase());
