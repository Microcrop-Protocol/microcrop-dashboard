import Papa from "papaparse";

export type CsvRow = Record<string, string>;

const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const FARMER_HEADER_MAP: Record<string, string> = {
  firstname: "firstName",
  fname: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  phonenumber: "phoneNumber",
  phone: "phoneNumber",
  mobile: "phoneNumber",
  mobilenumber: "phoneNumber",
  msisdn: "phoneNumber",
  contact: "phoneNumber",
  contactnumber: "phoneNumber",
  nationalid: "nationalId",
  nid: "nationalId",
  idnumber: "nationalId",
  county: "county",
  subcounty: "subCounty",
  ward: "ward",
  village: "village",
};

export const PLOT_HEADER_MAP: Record<string, string> = {
  farmerphone: "farmerPhone",
  phone: "farmerPhone",
  phonenumber: "farmerPhone",
  mobile: "farmerPhone",
  name: "name",
  plotname: "name",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  // Plot-size aliases. All collapse to the single canonical `acreage` field; the
  // *unit* is recovered separately from the original header (see detectAreaUnit)
  // and every value is normalized to acres before being stored.
  acreage: "acreage",
  area: "acreage",
  size: "acreage",
  landsize: "acreage",
  plotsize: "acreage",
  // hectare-denominated aliases
  hectares: "acreage",
  hectare: "acreage",
  ha: "acreage",
  areaha: "acreage",
  areahectares: "acreage",
  acreagehectares: "acreage",
  sizehectares: "acreage",
  sizeha: "acreage",
  // acre-denominated aliases
  acres: "acreage",
  acre: "acreage",
  areaacres: "acreage",
  acreageacres: "acreage",
  sizeacres: "acreage",
  croptype: "cropType",
  crop: "cropType",
};

export const FARMER_REQUIRED = ["firstName", "lastName", "phoneNumber", "nationalId", "county"];
export const PLOT_REQUIRED = ["farmerPhone", "name", "latitude", "longitude", "acreage", "cropType"];

export function makeHeaderNormalizer(map: Record<string, string>) {
  return (h: string): string => map[normalizeKey(h)] ?? h.trim();
}

export const normalizeFarmerHeader = makeHeaderNormalizer(FARMER_HEADER_MAP);
export const normalizePlotHeader = makeHeaderNormalizer(PLOT_HEADER_MAP);

type AreaUnit = "acres" | "hectares";

// Canonical plot-size unit. The backend and dashboard both treat `acreage` as
// ACRES (premium & sum-insured are computed from acres), so every uploaded
// value is normalized to acres before it is stored.
export const CANONICAL_AREA_UNIT: AreaUnit = "acres";

// 1 hectare = 2.47105 acres.
export const ACRES_PER_HECTARE = 2.47105;

// Canonical fields whose values are land-area measurements needing unit
// normalization.
const AREA_FIELDS = new Set<string>(["acreage"]);

// Recover the unit of a plot-size column from its ORIGINAL header. Hectare forms
// (e.g. "area_ha", "acreage_hectares", "hectares") take precedence over acre
// forms. Returns null when the header names no unit (bare "area"/"size"), in
// which case the canonical unit (acres) is assumed — see resolveAreaValue.
export function detectAreaUnit(rawHeader: string): AreaUnit | null {
  const key = normalizeKey(rawHeader);
  if (key.includes("hectare") || key.endsWith("ha")) return "hectares";
  if (key.includes("acre")) return "acres";
  return null;
}

// Normalize a single plot-size value to acres given the unit of its source
// header. Values already in acres (or with an unspecified unit, which defaults
// to acres) are returned byte-for-byte so correct data keeps full precision;
// only hectares are converted. Non-numeric values pass through untouched for
// downstream validation to reject.
const resolveAreaValue = (rawValue: string, unit: AreaUnit | null): string => {
  if (unit !== "hectares") return rawValue;
  const n = parseFloat(rawValue);
  if (!Number.isFinite(n)) return rawValue;
  return String(Number((n * ACRES_PER_HECTARE).toFixed(6)));
};

export interface ParseCsvOptions {
  normalizeHeader?: (h: string) => string;
  required?: string[];
}

export function parseCsv(
  text: string,
  options?: ParseCsvOptions
): { rows: CsvRow[]; error?: string; warnings?: string[] } {
  const normalizeHeader = options?.normalizeHeader ?? ((h: string) => h.trim());

  // Parse with RAW (only-trimmed) headers rather than mapping aliases inside
  // transformHeader. Mapping there is lossy: two aliased columns collapse to the
  // same key and the later one silently overwrites the earlier, and the original
  // unit of a plot-size column is discarded. We instead keep the raw headers and
  // resolve aliases deterministically below.
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  const fatal = result.errors.find((e) => e.type === "Delimiter" || e.code === "UndetectableDelimiter");
  if (fatal) return { rows: [], error: fatal.message };

  const rawRows = result.data.filter((row) => Object.values(row).some((v) => v !== ""));
  if (rawRows.length === 0) return { rows: [] };

  const rawHeaders = result.meta.fields ?? Object.keys(rawRows[0]);

  // Group the raw headers by the canonical field they resolve to, preserving
  // column order, so alias collisions are visible instead of silent.
  const sourcesByField = new Map<string, string[]>();
  for (const raw of rawHeaders) {
    const field = normalizeHeader(raw);
    const list = sourcesByField.get(field) ?? [];
    list.push(raw);
    sourcesByField.set(field, list);
  }

  // Deterministic alias priority: a header whose normalized form exactly matches
  // the canonical field name wins (prefer the canonical source); remaining ties
  // break by column order. Within each row the first non-empty source in that
  // order supplies the value, so a later column can never clobber an earlier,
  // correct one, and a present-but-lower-priority column is surfaced as a
  // warning rather than being silently dropped.
  const warnings: string[] = [];
  const prioritizedByField = new Map<string, string[]>();
  for (const [field, sources] of sourcesByField) {
    if (sources.length === 1) {
      prioritizedByField.set(field, sources);
      continue;
    }
    const fieldKey = normalizeKey(field);
    const exact = sources.filter((h) => normalizeKey(h) === fieldKey);
    const rest = sources.filter((h) => normalizeKey(h) !== fieldKey);
    const ordered = [...exact, ...rest];
    prioritizedByField.set(field, ordered);
    warnings.push(
      `Multiple columns map to "${field}" (${sources.join(", ")}); using "${ordered[0]}" first, ` +
        `then ${ordered.slice(1).join(", ")} as fallback.`
    );
  }

  const rows: CsvRow[] = rawRows.map((raw) => {
    const out: CsvRow = {};
    for (const [field, sources] of prioritizedByField) {
      const isArea = AREA_FIELDS.has(field);
      let value = "";
      for (const source of sources) {
        const candidate = raw[source];
        if (candidate !== undefined && candidate !== "") {
          value = isArea ? resolveAreaValue(candidate, detectAreaUnit(source)) : candidate;
          break;
        }
      }
      out[field] = value;
    }
    return out;
  });

  if (options?.required) {
    const headers = Object.keys(rows[0]);
    const missing = options.required.filter((f) => !headers.includes(f));
    if (missing.length > 0) {
      return { rows: [], error: `Missing required column(s): ${missing.join(", ")}` };
    }
  }

  return warnings.length > 0 ? { rows, warnings } : { rows };
}
