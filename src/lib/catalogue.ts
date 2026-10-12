/**
 * PRODUCT CATALOGUE — what a market lists, and what the dashboard may OFFER from it.
 *
 * WHAT THIS REPLACES. The partner screens drew their pickers from two global literals:
 * `CROP_TYPES` (fourteen crops, every value of the Prisma enum) and `LIVESTOCK_TYPES` (five
 * species including poultry). Every partner in every market was offered tea, cassava and banana —
 * crops no index product covers — and a Ghanaian field agent was offered the full Kenyan list.
 * The server now refuses a new plot or herd whose type is not in the organization's market
 * catalogue, so a global list would be a list of choices that come back 400.
 *
 * THE BACKEND IS THE AUTHORITY. `GET /api/catalogue` is built from
 * microcrop-backend/src/config/catalogue.js, and this file holds NO copy of it: no crop list, no
 * status, no TLU factor. What lives here is the reading of that answer — which items a picker may
 * offer, how a status is badged and explained, and how the catalogue refusals are worded.
 *
 * TWO DIFFERENT QUESTIONS, deliberately two predicates:
 *
 *   isSellable     may this item be QUOTED AND PURCHASED? AVAILABLE and PILOT, on a positive
 *                  `sellable === true` from the server. COMING_SOON is listed but not sold.
 *   isListed       is the code in the market catalogue at all? The server's test for creating a
 *                  plot or herd (PRODUCT_NOT_IN_MARKET). Existing rows with an unlisted legacy
 *                  code stay valid — they are displayed, never re-validated.
 *
 * Pickers have two purposes, matching the backend's two gates:
 *
 *   'sell'      choosing what to QUOTE or SELL. Only sellable items are choices; the rest are shown
 *               disabled with the reason (coming soon, pricing not configured yet).
 *   'register'  choosing the crop of a NEW plot. Every LISTED item is a choice — the backend's
 *               plot gate is PRODUCT_NOT_IN_MARKET (any status), so a coming-soon crop can be
 *               registered ahead of launch — and a not-yet-sellable one is labelled "Coming soon —
 *               cannot be insured yet" so nobody registers it expecting to quote it.
 *
 * SELLABLE COMES FROM THE SERVER. `item.sellable` is the server's answer and may be false for a
 * PILOT or AVAILABLE item it has not priced, with `item.reason` saying why. The dashboard never
 * re-derives sellability from `status` alone.
 *
 * FAIL-CLOSED, THE SAME WAY lib/capability.ts IS. Every condition is written in the positive. A
 * missing catalogue, a missing item, `sellable: 'true'`, or a status this build does not know all
 * land on "not offered". Nothing here ever defaults to Kenya's list.
 */
import { marketOrNull } from '@/lib/market';
import type {
  CatalogueItem,
  CatalogueLine,
  CatalogueMarket,
  CatalogueResponse,
  CatalogueStatus,
} from '@/types/catalogue';

export const CATALOGUE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  PILOT: 'PILOT',
  COMING_SOON: 'COMING_SOON',
} as const satisfies Record<string, CatalogueStatus>;

/** The error codes the backend returns for catalogue refusals. Keys match the backend exactly. */
export const PRODUCT_NOT_OFFERED = 'PRODUCT_NOT_OFFERED';
export const PRODUCT_NOT_IN_MARKET = 'PRODUCT_NOT_IN_MARKET';
export const PRICING_NOT_CONFIGURED = 'PRICING_NOT_CONFIGURED';

const SELLABLE_STATUSES: readonly CatalogueStatus[] = [
  CATALOGUE_STATUS.AVAILABLE,
  CATALOGUE_STATUS.PILOT,
];

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

/**
 * THREE-VALUED, for the same reason MarketState is (see lib/market.ts):
 *
 *   'loading'  the catalogue has not arrived. A picker renders a skeleton or nothing — offering
 *              the wrong market's crops for a beat is how a field agent registers one.
 *   'unknown'  the request failed, or the response carries no market for this organization.
 *              Offer NOTHING and say we could not load the list. Never fall back to Kenya.
 *   'known'    the organization's market catalogue is in hand.
 */
export type CatalogueState = 'loading' | 'unknown' | 'known';

/**
 * Pick the organization's market out of the response.
 *
 * An organization user's response holds only its own market, so with no country code in hand
 * (the organization row has not resolved yet) a single-market response IS that organization's
 * answer — the server scoped it. With a country code, the market must match it exactly; a
 * mismatch is a disagreement, not something to paper over, and returns null.
 */
export function selectMarketCatalogue(
  response: CatalogueResponse | null | undefined,
  countryCode: string | null | undefined,
): CatalogueMarket | null {
  const markets = Array.isArray(response?.markets) ? response.markets : [];
  const code = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  if (code) return markets.find((m) => m?.countryCode?.toUpperCase() === code) ?? null;
  return markets.length === 1 ? markets[0] : null;
}

export function resolveCatalogueState(
  selected: CatalogueMarket | null,
  hasResponse: boolean,
  isLoading: boolean,
): CatalogueState {
  // A cached answer survives a failed background refetch, as in resolveMarketState: knocking a
  // resolved catalogue back to 'loading' would empty every picker on window focus.
  if (!hasResponse) return isLoading ? 'loading' : 'unknown';
  return selected ? 'known' : 'unknown';
}

// ---------------------------------------------------------------------------
// READING ITEMS
// ---------------------------------------------------------------------------

/** The items of one line, in the server's order. Empty for a null market. */
export function catalogueItems(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
): CatalogueItem[] {
  const items = market?.lines?.[line];
  return Array.isArray(items) ? items : [];
}

export function findCatalogueItem(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
  code: string | null | undefined,
): CatalogueItem | null {
  if (!code) return null;
  return catalogueItems(market, line).find((item) => item.code === code) ?? null;
}

/** May this item be quoted and purchased? `=== true`, never `!== false`. */
export function isSellable(item: CatalogueItem | null | undefined): boolean {
  return item != null && item.sellable === true && SELLABLE_STATUSES.includes(item.status);
}

/** The reason codes the server may put on a not-sellable PILOT/AVAILABLE item. */
export const CATALOGUE_REASON = {
  PRICING_NOT_CONFIGURED,
} as const;

/**
 * Short copy for a not-sellable item's `reason`, or null when there is none. An unrecognised code
 * gets a generic line rather than the raw enum, and never a guess at what it means.
 */
export function catalogueReasonLabel(reason: string | null | undefined): string | null {
  if (typeof reason !== 'string' || !reason.trim()) return null;
  if (reason === PRICING_NOT_CONFIGURED) return 'Pricing not configured yet';
  return 'Not available to sell yet';
}

/**
 * The one line a picker shows under a NOT-sellable item, by purpose. Null for a sellable item.
 *
 *   sell      COMING_SOON → the coming-soon sentence; a server `reason` → its label; else
 *             "Not offered in {country}."
 *   register  "Coming soon — cannot be insured yet" for COMING_SOON; "{reason} — cannot be
 *             insured yet" for a priced-out item; the item stays selectable.
 */
export function notSellableNote(
  item: CatalogueItem,
  countryName: string,
  purpose: 'sell' | 'register',
): string | null {
  if (isSellable(item)) return null;
  const reason = catalogueReasonLabel(item.reason);
  if (purpose === 'register') {
    if (item.status === CATALOGUE_STATUS.COMING_SOON) return 'Coming soon — cannot be insured yet';
    return `${reason ?? 'Not available to sell yet'} — cannot be insured yet`;
  }
  if (item.status === CATALOGUE_STATUS.COMING_SOON) return comingSoonReason(item.label, countryName);
  return reason ?? `Not offered in ${countryName}.`;
}

/** Is the code in the market catalogue at all — the server's test for a NEW plot or herd. */
export function isListed(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
  code: string | null | undefined,
): boolean {
  return findCatalogueItem(market, line, code) !== null;
}

/**
 * Does this market list anything on the line? Ghana's LIVESTOCK list is empty: the line is
 * hidden there, not merely unsold. Null while the catalogue is not known, so a caller cannot
 * mistake "not loaded" for "not offered".
 */
export function lineOffered(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
): boolean | null {
  if (!market) return null;
  return catalogueItems(market, line).length > 0;
}

/**
 * "GREEN_GRAMS" -> "Green grams". DISPLAY ONLY, for a stored code the catalogue does not list —
 * a legacy plot of TEA is still a plot, and its row must still render a name.
 */
export function humanizeProductCode(code: string | null | undefined): string {
  if (!code) return '';
  const words = code.toLowerCase().split('_').filter(Boolean).join(' ');
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/** What to call a stored code: the catalogue label when listed, else the humanized code. */
export function productLabel(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
  code: string | null | undefined,
): string {
  return findCatalogueItem(market, line, code)?.label ?? humanizeProductCode(code);
}

/**
 * The crop code a policy covers. `GET /policies` carries it on the included plot
 * (`plot.cropType`) — the Policy row has no crop column — with a flat `cropType` read only as a
 * fallback for an older payload. Null when the policy has no crop (a livestock policy).
 */
export function policyCropCode(policy: {
  plot?: { cropType?: string | null } | null;
  cropType?: string | null;
}): string | null {
  const fromPlot = policy.plot?.cropType;
  if (typeof fromPlot === 'string' && fromPlot.trim()) return fromPlot.trim();
  const flat = policy.cropType;
  return typeof flat === 'string' && flat.trim() ? flat.trim() : null;
}

/**
 * What a policy row calls its crop: the catalogue's label when the market lists the code, else
 * the RAW code (the catalogue may not have loaded, or the crop may be legacy) — never blank. "—"
 * only when the payload carries no crop at all.
 */
export function policyCropLabel(
  market: CatalogueMarket | null | undefined,
  policy: Parameters<typeof policyCropCode>[0],
): string {
  const code = policyCropCode(policy);
  if (!code) return '—';
  return findCatalogueItem(market, 'CROP', code)?.label ?? code;
}

/**
 * Tropical Livestock Units for a herd, from the catalogue's factor. Null — not 0 — when the item
 * or its factor is missing: a zero TLU reads as "this herd is worth nothing", which is a claim,
 * while a dash is merely incomplete.
 */
export function tluFor(item: CatalogueItem | null | undefined, headCount: number): number | null {
  const factor = item?.tluFactor;
  if (typeof factor !== 'number' || !Number.isFinite(factor) || !Number.isFinite(headCount)) {
    return null;
  }
  return Math.round(headCount * factor * 100) / 100;
}

const toKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Resolve what a partner typed in an import file — `MAIZE`, `Maize`, `green grams`, `Green-Grams`
 * — to a listed item. Null when nothing in the market matches; the caller reports the row rather
 * than guessing.
 */
export function matchCatalogueItem(
  input: unknown,
  items: readonly CatalogueItem[],
): CatalogueItem | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const key = toKey(input);
  return items.find((item) => item.code === key || toKey(item.label) === key) ?? null;
}

/**
 * The crop a template or example should show: the first AVAILABLE item, else the first sellable
 * one. Null when the market sells nothing on the line — an example of an unsellable crop would be
 * an instruction to produce a refused row.
 */
export function exampleItem(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
): CatalogueItem | null {
  const items = catalogueItems(market, line);
  return (
    items.find((i) => isSellable(i) && i.status === CATALOGUE_STATUS.AVAILABLE) ??
    items.find((i) => isSellable(i)) ??
    null
  );
}

// ---------------------------------------------------------------------------
// COPY
//
// Centralised so the picker, the quote step and a refusal toast say the same thing. A COMING_SOON
// item is a product boundary, not a fault, and must never read as one.
// ---------------------------------------------------------------------------

/** Short badge text. Null for AVAILABLE, which needs no badge. */
export function catalogueStatusLabel(status: CatalogueStatus | string | null | undefined): string | null {
  if (status === CATALOGUE_STATUS.PILOT) return 'Pilot';
  if (status === CATALOGUE_STATUS.COMING_SOON) return 'Coming soon';
  return null;
}

/** Why a listed item is disabled in a picker. */
export function comingSoonReason(label: string, countryName: string): string {
  return `${label} cover is coming soon in ${countryName}. It is listed, but cannot be quoted or sold yet.`;
}

/** What a partner should know before selling a pilot product. */
export function pilotNote(label: string, countryName: string): string {
  return (
    `${label} is a pilot product in ${countryName}. It can be quoted and sold, and each policy ` +
    'records that it was sold under the pilot.'
  );
}

/**
 * Why an EXISTING plot or herd cannot be quoted, or null when it can. Reaches a stored code that
 * the catalogue has since marked coming-soon or never listed (a legacy crop).
 */
export function notSellableReason(
  market: CatalogueMarket | null | undefined,
  line: CatalogueLine,
  code: string | null | undefined,
): string | null {
  if (!market || !code) return null;
  const item = findCatalogueItem(market, line, code);
  if (isSellable(item)) return null;
  const label = item?.label ?? humanizeProductCode(code);
  if (!item) {
    return `${label} is not in the ${market.countryName} product catalogue, so it cannot be quoted or sold.`;
  }
  if (item.status === CATALOGUE_STATUS.COMING_SOON) return comingSoonReason(label, market.countryName);
  // Listed as PILOT/AVAILABLE, but the server says it cannot be sold — say the server's reason,
  // not "not in the catalogue", which would be false.
  const reason = catalogueReasonLabel(item.reason);
  return reason
    ? `${label} cannot be quoted or sold in ${market.countryName} yet — ${reason.toLowerCase()}.`
    : `${label} is listed in ${market.countryName} but cannot be quoted or sold yet.`;
}

/** The picker could not be filled because the catalogue did not load. */
export const CATALOGUE_UNKNOWN_MESSAGE =
  "We couldn't load your market's product list, so there is nothing to choose from yet. Try again in a moment.";

/** The catalogue is still on its way — not a failure, and not worded as one. */
export const CATALOGUE_LOADING_MESSAGE = "Your market's product list is still loading.";

/** A policy's frozen catalogue status, for a detail row. */
export function soldUnderLabel(status: CatalogueStatus | string | null | undefined): string | null {
  if (status === CATALOGUE_STATUS.AVAILABLE) return 'Generally available';
  if (status === CATALOGUE_STATUS.PILOT) return 'Pilot';
  return null;
}

function detailsObject(details: unknown): Record<string, unknown> | null {
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : null;
}

/**
 * User copy for the three catalogue refusals, built from the structured `details`
 * (`{ countryCode, line, item, status }`). Returns null for any other code, and for a refusal
 * that arrived without its details object — lib/error-messages then uses its static copy.
 *
 * The country is named only when it is a market this build knows — "not offered in your market"
 * is honest; naming a country we cannot confirm is not.
 */
export function catalogueRefusalMessage(code: string | undefined, details: unknown): string | null {
  if (
    code !== PRODUCT_NOT_OFFERED &&
    code !== PRODUCT_NOT_IN_MARKET &&
    code !== PRICING_NOT_CONFIGURED
  ) {
    return null;
  }

  const d = detailsObject(details);
  if (!d) return null;
  const countryName = marketOrNull(d.countryCode)?.countryName;
  const where = countryName ? `in ${countryName}` : 'in your market';
  const rawItem = typeof d.item === 'string' ? d.item : null;
  const isLivestock = d.line === 'LIVESTOCK';
  const what = rawItem ? humanizeProductCode(rawItem) : isLivestock ? 'This livestock type' : 'This crop';

  if (code === PRODUCT_NOT_OFFERED) {
    if (d.status === CATALOGUE_STATUS.COMING_SOON) {
      return `${what} cover is coming soon ${where} and cannot be quoted or sold yet.`;
    }
    return `${what} cover is not offered ${where}, so it cannot be quoted or sold.`;
  }

  if (code === PRODUCT_NOT_IN_MARKET) {
    const record = isLivestock ? 'herd' : 'plot';
    // A market with no livestock line (Ghana) has no list to choose from: "Choose one from the
    // list" would send the partner looking for a picker that does not exist.
    const market = marketOrNull(d.countryCode);
    if (isLivestock && market && !market.livestockEnabled) {
      return `Livestock cover is not offered in ${market.countryName}, so no herd can be registered there.`;
    }
    // A bulk refusal names every offending code in `items`; `item` is only the first of them.
    const items = Array.isArray(d.items) ? d.items.filter((i): i is string => typeof i === 'string') : [];
    if (items.length > 1) {
      return (
        `${items.map((i) => humanizeProductCode(i)).join(', ')} are not in the product list ${where}, ` +
        `so ${record}s cannot be registered with them. Choose from the list.`
      );
    }
    return `${what} is not in the product list ${where}, so a new ${record} cannot be registered with it. Choose one from the list.`;
  }

  return (
    `Pricing for ${rawItem ? humanizeProductCode(rawItem).toLowerCase() : 'this product'} is not ` +
    `configured ${where} yet, so no quote can be given. Contact MicroCrop.`
  );
}
