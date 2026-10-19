import { level1Label, type Market } from "@/lib/market";
import { marketSamples } from "@/lib/market-samples";
import {
  catalogueItems,
  exampleItem,
  isSellable,
  matchCatalogueItem,
  type CatalogueState,
} from "@/lib/catalogue";
import type { CatalogueItem, CatalogueMarket } from "@/types/catalogue";
import { CONSENT_DOCUMENT_IDS, CONSENT_METHOD_OPTIONS } from "@/lib/consent";
import { capIssues, summarizeIssues, type ImportIssue, type ImportReport } from "./importIssues";
import {
  acreageField,
  estimatedValueField,
  headCountField,
  herdNameField,
  isNullIsland,
  latitudeField,
  longitudeField,
  nationalIdField,
  NULL_ISLAND_MESSAGE,
  personNameField,
  plotNameField,
} from "@/lib/validations/onboarding-fields";

/**
 * The CSV templates are MARKET-DRIVEN, because a template is an instruction.
 *
 * They were literals containing `+254712345678`, `Nakuru` and `Maize`. The backend validates
 * every imported row against the organization's own market — the phone against its numbering
 * plan, and now the crop against its product catalogue — so a template carrying another
 * market's values hands back a file in which EVERY row fails.
 *
 * The sample crop is the market catalogue's first AVAILABLE crop (else its first sellable one,
 * else — in a market with nothing sellable yet — its first listed one),
 * written as the CODE the API takes (`MAIZE`, not `Maize`): the backend's validator matches the
 * enum exactly, so the old `Maize` sample was itself a refused value.
 *
 * The farmer HEADER names are deliberately unchanged — `county` is the column in every market;
 * only its label differs. Unknown pieces (market or catalogue not loaded) render EMPTY rather than
 * as another market's example.
 */
export function farmerCsvTemplate(market: Market | null): string {
  const samples = marketSamples(market);
  const phone = market?.phoneExample ?? "";
  // The optional columns are in the template so a partner sees they exist. kycStatus PENDING is
  // the default (APPROVED needs an admin); the consent columns are left empty — a sample consent
  // would be an instruction to claim consent the farmer never gave.
  return (
    `${FARMER_TEMPLATE_HEADER.join(",")}\n` +
    [
      "John", "Doe", phone, "12345678", samples?.level1 ?? "",
      samples?.level2 ?? "", samples?.ward ?? "", samples?.village ?? "", "PENDING",
      "", "", "", "", "",
    ].join(",")
  );
}

const FARMER_TEMPLATE_HEADER = [
  "firstName", "lastName", "phoneNumber", "nationalId", "county",
  "subCounty", "ward", "village", "kycStatus",
  "consentDocumentIds", "consentMethod", "consentGrantedAt", "consentEvidenceRef", "consentLocale",
];

/**
 * `plotName`, not `name`: it is the field the backend's bulk-plot validator requires. The header
 * normalizer still accepts `name`, and preparePlotRows maps either to `plotName` on the way out.
 */
export function plotCsvTemplate(market: Market | null, catalogue: CatalogueMarket | null): string {
  const samples = marketSamples(market);
  const phone = market?.phoneExample ?? "";
  // Plot registration takes any LISTED crop, sellable or not, so a market with nothing sellable
  // yet (a hidden market, every crop COMING_SOON) still gets a template that imports: its first
  // listed crop. Where something is sellable the example stays a crop that can be insured.
  const crop = (exampleItem(catalogue, "CROP") ?? catalogueItems(catalogue, "CROP")[0])?.code ?? "";
  // Coordinates inside the market, so a partner that imports the sample unedited does not create
  // a plot in the wrong country and then wonder why its satellite readings are empty.
  const lat = samples?.latitude ?? "";
  const lng = samples?.longitude ?? "";
  // A date inside the market's main season: the drought determination needs it.
  const planted = samples?.plantingDate ?? "";
  return (
    "farmerPhone,plotName,latitude,longitude,acreage,cropType,plantingDate\n" +
    `${phone},Plot A,${lat},${lng},2.5,${crop},${planted}`
  );
}

/** Sample value per head, in the market currency. Presentation only; not used in pricing. */
const SAMPLE_VALUE_PER_HEAD: Record<string, number> = {
  CATTLE: 40000,
  CAMEL: 80000,
  GOAT: 5000,
  SHEEP: 5000,
};

/**
 * The herds template. EMPTY when the market offers no livestock (Ghana): there is no file to fill
 * in, and the tab is hidden there. With the market or catalogue not yet known the header renders
 * with empty sample values, like the other templates.
 */
export function herdCsvTemplate(market: Market | null, catalogue: CatalogueMarket | null): string {
  if (market && !market.livestockEnabled) return "";
  if (catalogue && catalogueItems(catalogue, "LIVESTOCK").length === 0) return "";
  const samples = marketSamples(market);
  const phone = market?.phoneExample ?? "";
  const animal = exampleItem(catalogue, "LIVESTOCK")?.code ?? "";
  const value = animal ? String(SAMPLE_VALUE_PER_HEAD[animal] ?? 10000) : "";
  const lat = samples?.latitude ?? "";
  const lng = samples?.longitude ?? "";
  return (
    "farmerPhone,name,livestockType,headCount,estimatedValue,latitude,longitude\n" +
    `${phone},Herd A,${animal},10,${value},${lat},${lng}`
  );
}

/**
 * The JSON placeholders, DERIVED from the CSV templates rather than written out again, so the
 * two formats shown on one screen cannot drift apart.
 */
export function csvToJsonExample(csv: string): string {
  const [header, row] = csv.split("\n");
  const keys = header.split(",");
  const values = (row ?? "").split(",");
  const entries = keys.map((key, index) => {
    const raw = values[index] ?? "";
    // Numbers stay numbers in the example; a quoted latitude would be a wrong example.
    const value = raw !== "" && Number.isFinite(Number(raw)) && !/^\+/.test(raw) && key !== "nationalId"
      ? raw
      : JSON.stringify(raw);
    return `"${key}": ${value}`;
  });
  return `[{${entries.join(", ")}}]`;
}

/**
 * The crop codes a plots file may carry, grouped for the help text under the upload. Every LISTED
 * crop may be imported; the split is by what the SERVER says is sellable — so a coming-soon crop
 * and a pilot crop the server has not priced both land in `notInsurableYet`, rather than the
 * second vanishing from both lists.
 */
export function importableCrops(catalogue: CatalogueMarket | null): {
  sellable: CatalogueItem[];
  notInsurableYet: CatalogueItem[];
} {
  const crops = catalogueItems(catalogue, "CROP");
  return {
    sellable: crops.filter((c) => isSellable(c)),
    notInsurableYet: crops.filter((c) => !isSellable(c)),
  };
}

// ---------------------------------------------------------------------------
// PREPARERS
//
// Each runs on the parsed rows (CSV) or the pasted array (JSON) before anything is sent, checks
// them with the SAME field rules the onboarding wizards use (lib/validations/onboarding-fields),
// shapes them into what the API takes, and either returns the rows or a blocking report naming
// every bad row. Rows are 0-based here; formatIssue prints `row + 1`.
//
// The server checks everything again. These exist so a partner learns which rows to fix before
// the upload, not after a whole-batch 400.
// ---------------------------------------------------------------------------

export interface PreparedRows {
  /** Rows ready to send, or empty when `blocking` is set. */
  rows: Record<string, unknown>[];
  /** Set when the file must not be sent as-is. Rendered as the import report. */
  blocking: ImportReport | null;
}

type Row = Record<string, unknown>;

/** A trimmed string, or '' for absent / null. Numbers are stringified (a JSON nationalId). */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** A number from a CSV string or a JSON number. Undefined when blank; NaN when not a number. */
function numeric(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  const s = text(value);
  if (s === "") return undefined;
  return Number(s);
}

/** Run one shared field rule; on failure, record its message against the row. */
function check(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } },
  value: unknown,
  row: number,
  field: string,
  issues: ImportIssue[],
): boolean {
  const result = schema.safeParse(value);
  if (result.success) return true;
  issues.push({ row, field, message: result.error?.issues[0]?.message ?? `${field} is invalid` });
  return false;
}

function blockingReport(issues: ImportIssue[], noun: string): ImportReport {
  const failing = new Set(issues.map((i) => i.row)).size;
  return {
    tone: "error",
    title: `Fix ${failing} ${failing === 1 ? "row" : "rows"} before importing`,
    summary:
      `${failing} ${failing === 1 ? "row" : "rows"} of your ${noun} ${failing === 1 ? "has" : "have"} ` +
      "a problem. Fix them and import again — nothing was uploaded.",
    issues: capIssues(summarizeIssues(issues)),
  };
}

/**
 * The farmer a plot or herd row belongs to: by phone, by national ID, or both (the server then
 * requires both to name the same farmer). Blank keys are dropped — the server reads an empty
 * string as a value, not as "absent".
 */
function farmerKey(row: Row, index: number, issues: ImportIssue[]): Row {
  const phone = text(row.farmerPhone);
  const nationalId = text(row.farmerNationalId);
  const out: Row = {};
  if (!phone && !nationalId) {
    issues.push({ row: index, field: "farmerPhone", message: "farmerPhone or farmerNationalId is required" });
    return out;
  }
  if (phone) out.farmerPhone = phone;
  if (nationalId) {
    if (check(nationalIdField, nationalId, index, "farmerNationalId", issues)) out.farmerNationalId = nationalId;
  }
  return out;
}

/** Validate a coordinate pair with the shared rules; `required` false lets both be absent. */
function coordinates(row: Row, index: number, issues: ImportIssue[], required: boolean): Row {
  const lat = numeric(row.latitude);
  const lng = numeric(row.longitude);
  const out: Row = {};
  let ok = true;
  for (const [field, value, schema] of [
    ["latitude", lat, latitudeField],
    ["longitude", lng, longitudeField],
  ] as const) {
    if (value === undefined) {
      if (required) {
        issues.push({ row: index, field, message: `${field} is required` });
        ok = false;
      }
      continue;
    }
    if (check(schema, value, index, field, issues)) out[field] = value;
    else ok = false;
  }
  // Optional means "both or neither": one coordinate alone is not a location.
  if (!required && (lat === undefined) !== (lng === undefined)) {
    const missing = lat === undefined ? "latitude" : "longitude";
    issues.push({
      row: index,
      field: missing,
      message: "Give both latitude and longitude, or leave both empty",
    });
    return {};
  }
  if (ok && isNullIsland(out.latitude, out.longitude)) {
    issues.push({ row: index, field: "latitude", message: NULL_ISLAND_MESSAGE });
  }
  return out;
}

// --- farmers ---------------------------------------------------------------

/** The backend's wording for a yes/no consent column (staff.validator `blanketConsentFlag`). */
export const BLANKET_CONSENT_MESSAGE =
  "A blanket consent flag is not a consent record. Put a per-farmer consent object " +
  "(documentIds, method, grantedAt, evidenceRef) on each row that actually has consent, " +
  "and leave it off the rows that do not.";

const BLANKET_CONSENT_KEYS = new Set(["consented", "hasconsent", "consentall"]);

const CONSENT_COLUMNS = {
  documentIds: "consentDocumentIds",
  method: "consentMethod",
  grantedAt: "consentGrantedAt",
  evidenceRef: "consentEvidenceRef",
  locale: "consentLocale",
} as const;

const CONSENT_REQUIRED = ["documentIds", "method", "grantedAt", "evidenceRef"] as const;

const KYC_STATUSES = new Set(["PENDING", "APPROVED"]);

const CONSENT_ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const VALID_DOCUMENT_IDS = new Set<string>(CONSENT_DOCUMENT_IDS);
/** Consent method codes the API takes, in the order the help text lists them. */
export const CONSENT_METHOD_CODES: string[] = CONSENT_METHOD_OPTIONS.map((m) => m.value);
const VALID_METHODS = new Set(CONSENT_METHOD_CODES);

/**
 * Fold the flattened consent columns into the nested `consent` object the API takes.
 *   all empty  → no consent (the farmer's consent reads NOT_GIVEN, which is the truth)
 *   partial    → a row issue: half a consent record is not a consent record
 *   a JSON row → its own `consent` object passes through as-is (the server validates it)
 */
function foldConsent(row: Row, index: number, issues: ImportIssue[]): Record<string, unknown> | undefined {
  const flat = Object.fromEntries(
    Object.entries(CONSENT_COLUMNS).map(([part, column]) => [part, text(row[column])]),
  ) as Record<keyof typeof CONSENT_COLUMNS, string>;
  const anyFlat = Object.values(flat).some((v) => v !== "");
  const nested = row.consent;

  if (!anyFlat) {
    return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : undefined;
  }
  if (nested !== undefined && nested !== null && nested !== "") {
    issues.push({
      row: index,
      field: "consent",
      message: "Give consent as the consent columns or as a consent object, not both",
    });
    return undefined;
  }
  const missing = CONSENT_REQUIRED.filter((part) => flat[part] === "").map((part) => CONSENT_COLUMNS[part]);
  if (missing.length > 0) {
    issues.push({
      row: index,
      field: "consent",
      message:
        `Consent is incomplete — missing ${missing.join(", ")}. Fill every consent column for a ` +
        "farmer who consented, or leave them all empty.",
    });
    return undefined;
  }
  // The server takes ISO dates only (Joi date().iso()) and refuses one later than now.
  if (!CONSENT_ISO_DATE.test(flat.grantedAt) || Number.isNaN(Date.parse(flat.grantedAt))) {
    issues.push({
      row: index,
      field: "consentGrantedAt",
      message: `"${flat.grantedAt}" is not a date — use YYYY-MM-DD`,
    });
    return undefined;
  }
  if (Date.parse(flat.grantedAt) > Date.now()) {
    issues.push({
      row: index,
      field: "consentGrantedAt",
      message: `${flat.grantedAt} is in the future — consent is dated when the farmer gave it`,
    });
    return undefined;
  }
  const documentIds = [
    ...new Set(flat.documentIds.split(/[;|]/).map((d) => d.trim().toUpperCase()).filter(Boolean)),
  ];
  const unknownIds = documentIds.filter((id) => !VALID_DOCUMENT_IDS.has(id));
  if (documentIds.length === 0 || unknownIds.length > 0) {
    issues.push({
      row: index,
      field: "consentDocumentIds",
      message:
        (unknownIds.length > 0 ? `Unknown consent document ${unknownIds.join(", ")}. ` : "") +
        `Use ${CONSENT_DOCUMENT_IDS.join(" and/or ")}`,
    });
    return undefined;
  }
  // The API's method codes are upper snake case (IN_PERSON_SIGNATURE); accept "In person signature".
  const method = flat.method.toUpperCase().replace(/[\s-]+/g, "_");
  if (!VALID_METHODS.has(method)) {
    issues.push({
      row: index,
      field: "consentMethod",
      message: `"${flat.method}" is not a consent method — use one of ${CONSENT_METHOD_CODES.join(", ")}`,
    });
    return undefined;
  }
  const consent: Record<string, unknown> = {
    documentIds,
    method,
    grantedAt: flat.grantedAt,
    evidenceRef: flat.evidenceRef,
  };
  if (flat.locale) consent.locale = flat.locale;
  return consent;
}

/**
 * Check and shape farmer rows. Required: firstName, lastName, phoneNumber, nationalId, county
 * (the market's level-1 division). Names 2–50 and nationalId 6–20, the wizard's rules. The phone
 * is sent as typed: the server normalises it to the organization's market (0712…, 2547…, spaced)
 * and refuses another market's number per row.
 *
 * `kycStatus` PENDING (default) or APPROVED; the server honours APPROVED only for an importer
 * holding kyc:decide. A yes/no consent column is refused here with the backend's own wording.
 */
export function prepareFarmerRows(rows: Row[], market: Market | null): PreparedRows {
  const blanket = rows.some((row) =>
    Object.keys(row).some((key) => BLANKET_CONSENT_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ""))),
  );
  if (blanket) {
    return {
      rows: [],
      blocking: {
        tone: "error",
        title: "A yes/no consent column can't be imported",
        summary:
          "Remove the consented column and fill the consent columns (consentDocumentIds, " +
          "consentMethod, consentGrantedAt, consentEvidenceRef) on the rows that actually have " +
          "consent. Nothing was uploaded.",
        issues: [BLANKET_CONSENT_MESSAGE],
      },
    };
  }

  const labels: Record<string, string> = {
    firstName: "First name",
    lastName: "Last name",
    phoneNumber: "Phone number",
    nationalId: "National ID",
    county: level1Label(market),
  };
  const issues: ImportIssue[] = [];

  const prepared = rows.map((row, index) => {
    const out: Row = {};
    for (const field of ["firstName", "lastName", "phoneNumber", "nationalId", "county"] as const) {
      const value = text(row[field]);
      if (value === "") {
        issues.push({ row: index, field, message: `${labels[field]} is required` });
        continue;
      }
      out[field] = value;
    }
    if (out.firstName !== undefined) check(personNameField("First name"), out.firstName, index, "firstName", issues);
    if (out.lastName !== undefined) check(personNameField("Last name"), out.lastName, index, "lastName", issues);
    if (out.nationalId !== undefined) check(nationalIdField, out.nationalId, index, "nationalId", issues);

    for (const field of ["subCounty", "ward", "village"] as const) {
      const value = text(row[field]);
      if (value) out[field] = value;
    }

    const kyc = text(row.kycStatus).toUpperCase();
    if (kyc) {
      if (KYC_STATUSES.has(kyc)) out.kycStatus = kyc;
      else issues.push({ row: index, field: "kycStatus", message: `kycStatus must be PENDING or APPROVED, not "${text(row.kycStatus)}"` });
    }

    const consent = foldConsent(row, index, issues);
    if (consent) out.consent = consent;
    return out;
  });

  if (issues.length > 0) return { rows: [], blocking: blockingReport(issues, "farmers") };
  return { rows: prepared, blocking: null };
}

// --- plots -----------------------------------------------------------------

const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/;
const DAY_FIRST_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

function isoDay(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A planting date as ISO `YYYY-MM-DD`. Accepts `2026-03-15` (and an ISO date-time), and a
 * day/month/year date only where it cannot be read two ways (`15/03/2026`). `03/04/2026` is
 * refused rather than guessed: day-first and month-first spreadsheets both exist, and a planting
 * date a month out moves the whole determination window.
 */
export function parsePlantingDate(value: unknown): { iso: string } | { error: string } | null {
  const s = text(value);
  if (s === "") return null;
  const bad = { error: `"${s}" is not a date — use YYYY-MM-DD` };
  let m = ISO_DATE.exec(s);
  if (m) {
    const iso = isoDay(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { iso } : bad;
  }
  m = DAY_FIRST_DATE.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    let iso: string | null = null;
    if (a === b || (a > 12 && b <= 12)) iso = isoDay(y, b, a);
    else if (b > 12 && a <= 12) iso = isoDay(y, a, b);
    else return { error: `"${s}" could be day/month or month/day — use YYYY-MM-DD` };
    return iso ? { iso } : bad;
  }
  return bad;
}

/**
 * Check and shape plot rows before they reach the server.
 *
 *   FARMER   farmerPhone or farmerNationalId (or both, which must name the same farmer).
 *   NAME     `name` (what the header normalizer produces) is sent as `plotName`, the field the
 *            backend validator requires. 2–100, the wizard's rule.
 *   PLACE    latitude/longitude numbers in range; the (0,0) pair is refused (a missing location),
 *            longitude 0 alone is not (Ghana sits on the Greenwich meridian).
 *   SIZE     acreage in acres, 0.1–10,000 (hectare columns were converted by parseCsv).
 *   CROP     each `cropType` is matched against the market's CROP line — by code or label, any
 *            case, so `Maize` and `green grams` resolve — and rewritten to the code. A crop the
 *            market does not list is reported by ROW, before upload. Coming-soon crops are
 *            LISTED, so the server accepts them; they pass.
 *   PLANTED  optional `plantingDate`, sent as ISO `YYYY-MM-DD`. The drought determination cannot
 *            run without it.
 *
 * With no catalogue there is nothing to check against, and the file is held rather than sent
 * unchecked — and the hold says WHICH of two things happened: the list is still on its way
 * (`state: 'loading'`, a wait, not a fault) or it failed to load.
 */
export function preparePlotRows(
  rows: Row[],
  catalogue: CatalogueMarket | null,
  state: CatalogueState = catalogue ? "known" : "unknown",
): PreparedRows {
  if (!catalogue) {
    const loading = state === "loading";
    return {
      rows: [],
      blocking: {
        tone: loading ? "warning" : "error",
        title: loading ? "Crop list still loading" : "Crop list unavailable",
        summary: loading
          ? "Your market's crop list is still loading, so the file can't be checked yet. Import again in a moment — nothing was uploaded."
          : "We couldn't load your market's crop list, so the file can't be checked. Try again in a moment.",
        issues: [],
      },
    };
  }

  const crops = catalogueItems(catalogue, "CROP");
  const issues: ImportIssue[] = [];
  const prepared = rows.map((row, index) => {
    const out: Row = farmerKey(row, index, issues);

    const plotName = text(row.plotName ?? row.name);
    if (check(plotNameField, plotName, index, "plotName", issues)) out.plotName = plotName;

    Object.assign(out, coordinates(row, index, issues, true));

    const acreage = numeric(row.acreage);
    if (acreage === undefined) issues.push({ row: index, field: "acreage", message: "acreage is required" });
    else if (check(acreageField, acreage, index, "acreage", issues)) out.acreage = acreage;

    const item = matchCatalogueItem(row.cropType, crops);
    if (!item) {
      const shown = text(row.cropType) ? `"${text(row.cropType)}"` : "A blank crop";
      issues.push({
        row: index,
        field: "cropType",
        message: `${shown} is not in the ${catalogue.countryName} crop list`,
      });
    } else {
      out.cropType = item.code;
    }

    const planted = parsePlantingDate(row.plantingDate);
    if (planted && "error" in planted) issues.push({ row: index, field: "plantingDate", message: planted.error });
    else if (planted) out.plantingDate = planted.iso;

    return out;
  });

  if (issues.length > 0) {
    const failing = new Set(issues.map((i) => i.row)).size;
    // A file whose only problem is crops keeps the catalogue wording: it is a product boundary.
    if (issues.every((i) => i.field === "cropType")) {
      return {
        rows: [],
        blocking: {
          tone: "error",
          title: `Crops not offered in ${catalogue.countryName}`,
          summary:
            `${failing} ${failing === 1 ? "row uses" : "rows use"} a crop that isn't in your market's ` +
            "product list. Fix them and import again — nothing was uploaded.",
          issues: capIssues(summarizeIssues(issues)),
        },
      };
    }
    return { rows: [], blocking: blockingReport(issues, "plots") };
  }

  return { rows: prepared, blocking: null };
}

// --- herds -----------------------------------------------------------------

function livestockNotOffered(countryName: string): ImportReport {
  return {
    tone: "error",
    title: `Livestock cover is not offered in ${countryName}`,
    summary: `${countryName} lists no livestock products, so herds can't be imported. Nothing was uploaded.`,
    issues: [],
  };
}

/**
 * Check and shape herd rows. Herd import is the file alternative to livestock onboarding.
 *
 *   MARKET   a market that offers no livestock (Ghana) blocks the whole file — the server refuses
 *            it with PRODUCT_NOT_IN_MARKET anyway.
 *   FARMER   farmerPhone or farmerNationalId, as for plots. The farmer's county must match an
 *            active insurance unit; only the server knows that, and reports it per row.
 *   TYPE     `livestockType` matched against the market's LIVESTOCK line (listed), by code or
 *            label, and rewritten to the code. POULTRY is in no market's list.
 *   COUNT    `headCount` a whole number, 1–100,000 (it drives TLU, premium and sum insured).
 *   VALUE    `estimatedValue` per head, in the market currency, above 0.
 *   PLACE    latitude/longitude optional; (0,0) refused.
 *
 * Not sent: insuranceUnitId (derived from the farmer's county), season (chosen at quote), tluCount
 * (computed server-side), herdId. The server strips them; they are dropped here so a file that
 * carries them is not mistaken for one that sets them.
 */
export function prepareHerdRows(
  rows: Row[],
  catalogue: CatalogueMarket | null,
  market: Market | null,
  state: CatalogueState = catalogue ? "known" : "unknown",
): PreparedRows {
  if (market && !market.livestockEnabled) {
    return { rows: [], blocking: livestockNotOffered(market.countryName) };
  }
  if (!catalogue) {
    const loading = state === "loading";
    return {
      rows: [],
      blocking: {
        tone: loading ? "warning" : "error",
        title: loading ? "Livestock list still loading" : "Livestock list unavailable",
        summary: loading
          ? "Your market's livestock list is still loading, so the file can't be checked yet. Import again in a moment — nothing was uploaded."
          : "We couldn't load your market's livestock list, so the file can't be checked. Try again in a moment.",
        issues: [],
      },
    };
  }
  const livestock = catalogueItems(catalogue, "LIVESTOCK");
  if (livestock.length === 0) {
    return { rows: [], blocking: livestockNotOffered(catalogue.countryName) };
  }

  const issues: ImportIssue[] = [];
  const prepared = rows.map((row, index) => {
    const out: Row = farmerKey(row, index, issues);

    const name = text(row.name ?? row.herdName);
    if (check(herdNameField, name, index, "name", issues)) out.name = name;

    const item = matchCatalogueItem(row.livestockType, livestock);
    if (!item) {
      const shown = text(row.livestockType) ? `"${text(row.livestockType)}"` : "A blank livestock type";
      issues.push({
        row: index,
        field: "livestockType",
        message: `${shown} is not in the ${catalogue.countryName} livestock list`,
      });
    } else {
      out.livestockType = item.code;
    }

    const headCount = numeric(row.headCount);
    if (headCount === undefined) issues.push({ row: index, field: "headCount", message: "headCount is required" });
    else if (check(headCountField, headCount, index, "headCount", issues)) out.headCount = headCount;

    const value = numeric(row.estimatedValue);
    if (value === undefined) issues.push({ row: index, field: "estimatedValue", message: "estimatedValue is required" });
    else if (check(estimatedValueField, value, index, "estimatedValue", issues)) out.estimatedValue = value;

    Object.assign(out, coordinates(row, index, issues, false));
    return out;
  });

  if (issues.length > 0) return { rows: [], blocking: blockingReport(issues, "herds") };
  return { rows: prepared, blocking: null };
}
