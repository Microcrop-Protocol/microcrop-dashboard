/**
 * MARKET FILTER — which market a platform-admin screen is looking at.
 *
 * A platform admin has no market of their own (see hooks/useOrgMarket), so every cross-org screen
 * needs the market as an explicit, visible choice. Two modes, and the difference is about money:
 *
 *   'any'     All markets, or one. For screens whose figures are counts (organizations, farmers,
 *             policies, damage scores), or whose money arrives already split per currency
 *             (the overview's `byCurrency`). "All" is meaningful there.
 *   'single'  Exactly one market. For screens whose figures are a single money series in a local
 *             currency (revenue) or must be read against one (payouts). "All" would mean adding
 *             KES to GHS, which has no unit, so it is not offered.
 *
 * THE SINGLE-MARKET DEFAULT IS THE FIRST MARKET IN REGISTRY ORDER, AND IT IS SHOWN. It happens to
 * be Kenya today, but it is read from SUPPORTED_COUNTRY_CODES rather than written as 'KE', and the
 * selector always renders the market in use — so the page never reports a market the operator
 * cannot see it chose. There is no `?? 'KE'` anywhere in this file.
 */
import {
  MARKETS,
  SUPPORTED_COUNTRY_CODES,
  isSupportedCountry,
  type CountryCode,
  type Market,
} from './market';

export const ALL_MARKETS = 'ALL' as const;

export type MarketFilter = CountryCode | typeof ALL_MARKETS;

export type MarketFilterMode = 'any' | 'single';

/** The URL search parameter the filter lives in, so a filtered view is shareable and survives reload. */
export const MARKET_SEARCH_PARAM = 'market';

/** 'ALL' for mixed-friendly screens; the first registry market for money screens. */
export function defaultMarketFilter(mode: MarketFilterMode): MarketFilter {
  return mode === 'single' ? SUPPORTED_COUNTRY_CODES[0] : ALL_MARKETS;
}

/**
 * Read a filter from a URL value. Anything unrecognised — including 'ALL' on a single-market
 * screen — lands on that mode's default rather than on a guess.
 */
export function parseMarketFilter(raw: string | null | undefined, mode: MarketFilterMode): MarketFilter {
  if (isSupportedCountry(raw)) return raw.trim().toUpperCase() as CountryCode;
  if (mode === 'any' && typeof raw === 'string' && raw.trim().toUpperCase() === ALL_MARKETS) {
    return ALL_MARKETS;
  }
  return defaultMarketFilter(mode);
}

/** Options for the selector, in registry order, with "All markets" first where it is offered. */
export function marketFilterOptions(mode: MarketFilterMode): { value: MarketFilter; label: string }[] {
  const markets = SUPPORTED_COUNTRY_CODES.map((code) => ({
    value: code as MarketFilter,
    label: `${MARKETS[code].countryName} (${MARKETS[code].currency})`,
  }));
  return mode === 'any' ? [{ value: ALL_MARKETS, label: 'All markets' }, ...markets] : markets;
}

/** The `?countryCode=` value to send: undefined for all markets. */
export function countryCodeParam(filter: MarketFilter): CountryCode | undefined {
  return filter === ALL_MARKETS ? undefined : filter;
}

/** The market a filter names, or null for all markets. */
export function marketForFilter(filter: MarketFilter): Market | null {
  return filter === ALL_MARKETS ? null : MARKETS[filter];
}

/**
 * Plural of an administrative-division label for a "covered" tile: County → Counties,
 * Region → Regions, "County / Region" → "Counties / Regions". Only the labels the registry
 * actually carries need to come out right.
 */
export function pluralDivisionLabel(label: string): string {
  return label
    .split(' / ')
    .map((part) => (/[^aeiou]y$/i.test(part) ? `${part.slice(0, -1)}ies` : `${part}s`))
    .join(' / ');
}

/**
 * What to call the `county` column on a screen that may span markets. One market → its own label
 * (County / Region). All markets → both, because a single label would be wrong for one of them.
 */
export function divisionLabelForFilter(filter: MarketFilter): string {
  if (filter !== ALL_MARKETS) return MARKETS[filter].adminDivisionLabels.level1;
  const labels = SUPPORTED_COUNTRY_CODES.map((c) => MARKETS[c].adminDivisionLabels.level1);
  return Array.from(new Set(labels)).join(' / ');
}
