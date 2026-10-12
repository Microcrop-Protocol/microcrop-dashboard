import type { Market } from "@/lib/market";
import { marketSamples } from "@/lib/market-samples";
import {
  CATALOGUE_STATUS,
  catalogueItems,
  exampleItem,
  isSellable,
  matchCatalogueItem,
} from "@/lib/catalogue";
import type { CatalogueItem, CatalogueMarket } from "@/types/catalogue";
import { summarizeIssues, type ImportIssue, type ImportReport } from "./importIssues";

/**
 * The CSV templates are MARKET-DRIVEN, because a template is an instruction.
 *
 * They were literals containing `+254712345678`, `Nakuru` and `Maize`. The backend validates
 * every imported row against the organization's own market — the phone against its numbering
 * plan, and now the crop against its product catalogue — so a template carrying another
 * market's values hands back a file in which EVERY row fails.
 *
 * The sample crop is the market catalogue's first AVAILABLE crop (else its first sellable one),
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
  return `firstName,lastName,phoneNumber,nationalId,county\nJohn,Doe,${phone},12345678,${samples?.level1 ?? ""}`;
}

/**
 * `plotName`, not `name`: it is the field the backend's bulk-plot validator requires. The header
 * normalizer still accepts `name`, and preparePlotRows maps either to `plotName` on the way out.
 */
export function plotCsvTemplate(market: Market | null, catalogue: CatalogueMarket | null): string {
  const samples = marketSamples(market);
  const phone = market?.phoneExample ?? "";
  const crop = exampleItem(catalogue, "CROP")?.code ?? "";
  // Coordinates inside the market, so a partner that imports the sample unedited does not create
  // a plot in the wrong country and then wonder why its satellite readings are empty.
  const lat = samples?.latitude ?? "";
  const lng = samples?.longitude ?? "";
  return `farmerPhone,plotName,latitude,longitude,acreage,cropType\n${phone},Plot A,${lat},${lng},2.5,${crop}`;
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

/** The crop codes a plots file may carry, grouped for the help text under the upload. */
export function importableCrops(catalogue: CatalogueMarket | null): {
  sellable: CatalogueItem[];
  comingSoon: CatalogueItem[];
} {
  const crops = catalogueItems(catalogue, "CROP");
  return {
    sellable: crops.filter((c) => isSellable(c)),
    comingSoon: crops.filter((c) => c.status === CATALOGUE_STATUS.COMING_SOON),
  };
}

export interface PreparedPlots {
  /** Rows ready to send, or empty when `blocking` is set. */
  plots: Record<string, unknown>[];
  /** Set when the file must not be sent as-is. Rendered as the import report. */
  blocking: ImportReport | null;
}

/**
 * Check and shape plot rows before they reach the server.
 *
 *   CROP     each `cropType` is matched against the market's CROP line — by code or label, any
 *            case, so `Maize` and `green grams` resolve — and rewritten to the code. A crop the
 *            market does not list is reported here by ROW, before upload: the server's refusal
 *            (PRODUCT_NOT_IN_MARKET) would name the problem but not which rows carry it.
 *            Coming-soon crops are LISTED, so the server accepts them; they pass.
 *   NAME     `name` (what the header normalizer produces) is sent as `plotName`, the field the
 *            backend validator requires. Sending `name` failed every row.
 *
 * With no catalogue there is nothing to check against, and the file is held rather than sent
 * unchecked.
 */
export function preparePlotRows(
  rows: Record<string, unknown>[],
  catalogue: CatalogueMarket | null,
): PreparedPlots {
  if (!catalogue) {
    return {
      plots: [],
      blocking: {
        tone: "error",
        title: "Crop list unavailable",
        summary:
          "We couldn't load your market's crop list, so the file can't be checked. Try again in a moment.",
        issues: [],
      },
    };
  }

  const crops = catalogueItems(catalogue, "CROP");
  const issues: ImportIssue[] = [];
  const plots = rows.map((row, index) => {
    const { name, plotName, cropType, ...rest } = row;
    const item = matchCatalogueItem(cropType, crops);
    if (!item) {
      const shown = typeof cropType === "string" && cropType.trim() ? `"${cropType.trim()}"` : "A blank crop";
      issues.push({
        row: index,
        field: "cropType",
        message: `${shown} is not in the ${catalogue.countryName} crop list`,
      });
    }
    return {
      ...rest,
      plotName: plotName ?? name,
      cropType: item?.code ?? cropType,
    };
  });

  if (issues.length > 0) {
    const failing = new Set(issues.map((i) => i.row)).size;
    return {
      plots: [],
      blocking: {
        tone: "error",
        title: `Crops not offered in ${catalogue.countryName}`,
        summary:
          `${failing} ${failing === 1 ? "row uses" : "rows use"} a crop that isn't in your market's ` +
          "product list. Fix them and import again — nothing was uploaded.",
        issues: summarizeIssues(issues),
      },
    };
  }

  return { plots, blocking: null };
}
