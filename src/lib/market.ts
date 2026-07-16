/**
 * Market foundation — the single source of truth for country-specific concerns
 * (currency, phone dial code, mobile-money brand) across the dashboard.
 *
 * MicroCrop's backend is multi-country: an organization carries a
 * `countryCode` / `country` and a `currency`. The dashboard historically
 * hardcoded Kenya (KES, +254, Safaricom/M-Pesa). This module generalizes that:
 * every currency amount, phone input/validation, and country/mobile-money label
 * should be derived from the ORG'S MARKET via the helpers below — NOT from a
 * Kenya constant.
 *
 * Behavior is preserved for Kenyan orgs: they still resolve to KES / +254 /
 * M-Pesa, and anything with missing/unknown country data falls back to Kenya
 * (DEFAULT_MARKET) so nothing breaks.
 *
 * - Pure helpers (formatCurrency, resolveMarket, dial-code/phone helpers) have
 *   no React dependency and can be imported anywhere.
 * - `useMarket()` is a React hook that returns the current logged-in org's
 *   market by reading the existing auth store + org endpoint.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A country market: everything the UI needs to localize money + phone + labels. */
export interface Market {
  /** ISO 3166-1 alpha-2 country code, e.g. 'KE'. */
  code: string;
  /** Human country name, e.g. 'Kenya'. */
  country: string;
  /** ISO 4217 currency code, e.g. 'KES'. */
  currency: string;
  /** International dialing prefix incl. '+', e.g. '+254'. */
  dialCode: string;
  /** Mobile-money brand shown in copy, e.g. 'M-Pesa'. */
  mobileMoney: string;
  /** BCP-47 locale used for Intl number formatting, e.g. 'en-KE'. */
  locale: string;
}

/**
 * Tolerant, structural view of an organization for market resolution. All
 * fields are optional so any org-like object (including the app's
 * `Organization` type, whose TS shape may not yet declare these fields even
 * though the multi-country backend returns them) can be passed safely.
 */
export interface MarketOrgLike {
  countryCode?: string | null;
  country?: string | null;
  currency?: string | null;
}

/** Accepts either an ISO code, a currency code, a Market, or an org-like object. */
export type MarketInput = string | Market | MarketOrgLike | null | undefined;

// ---------------------------------------------------------------------------
// Market registry
// ---------------------------------------------------------------------------

/** Supported markets, keyed by ISO 3166-1 alpha-2 country code. */
export const MARKETS: Record<string, Market> = {
  KE: {
    code: 'KE',
    country: 'Kenya',
    currency: 'KES',
    dialCode: '+254',
    mobileMoney: 'M-Pesa',
    locale: 'en-KE',
  },
  GH: {
    code: 'GH',
    country: 'Ghana',
    currency: 'GHS',
    dialCode: '+233',
    mobileMoney: 'MTN MoMo',
    locale: 'en-GH',
  },
};

/** Default market so nothing breaks when country data is missing/unknown. */
export const DEFAULT_MARKET: Market = MARKETS.KE;

/** Lower-cased country-name → ISO code index (built from MARKETS + aliases). */
const COUNTRY_NAME_TO_CODE: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const m of Object.values(MARKETS)) {
    idx[m.country.toLowerCase()] = m.code;
  }
  return idx;
})();

/** Currency code → ISO country code index (first market that uses it wins). */
const CURRENCY_TO_CODE: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const m of Object.values(MARKETS)) {
    if (!(m.currency in idx)) idx[m.currency] = m.code;
  }
  return idx;
})();

// ---------------------------------------------------------------------------
// Market resolution
// ---------------------------------------------------------------------------

function isMarket(x: unknown): x is Market {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as Market).code === 'string' &&
    typeof (x as Market).currency === 'string' &&
    typeof (x as Market).dialCode === 'string'
  );
}

/** Look up a market by ISO country code (case-insensitive). Undefined if unknown. */
export function getMarketByCode(code?: string | null): Market | undefined {
  if (!code) return undefined;
  return MARKETS[code.trim().toUpperCase()];
}

/** Look up a market by country name (case-insensitive). Undefined if unknown. */
export function getMarketByCountryName(name?: string | null): Market | undefined {
  if (!name) return undefined;
  const code = COUNTRY_NAME_TO_CODE[name.trim().toLowerCase()];
  return code ? MARKETS[code] : undefined;
}

/** Look up a market by currency code (case-insensitive). Undefined if unknown. */
export function getMarketByCurrency(currency?: string | null): Market | undefined {
  if (!currency) return undefined;
  const code = CURRENCY_TO_CODE[currency.trim().toUpperCase()];
  return code ? MARKETS[code] : undefined;
}

/**
 * Resolve an organization to its Market. Tolerant of missing data:
 * prefers `countryCode`, then `country` (name), then `currency`, and finally
 * falls back to DEFAULT_MARKET (Kenya) so callers never get undefined.
 */
export function resolveMarket(org?: MarketOrgLike | null): Market {
  if (!org) return DEFAULT_MARKET;
  return (
    getMarketByCode(org.countryCode) ??
    getMarketByCountryName(org.country) ??
    // A country field may itself hold an ISO code (e.g. some endpoints send 'KE').
    getMarketByCode(org.country) ??
    getMarketByCurrency(org.currency) ??
    DEFAULT_MARKET
  );
}

/**
 * Coerce any MarketInput (ISO code, currency code, Market, or org-like object)
 * into a concrete Market, defaulting to DEFAULT_MARKET.
 */
export function toMarket(input?: MarketInput): Market {
  if (!input) return DEFAULT_MARKET;
  if (isMarket(input)) return input;
  if (typeof input === 'string') {
    return (
      getMarketByCode(input) ??
      getMarketByCurrency(input) ??
      getMarketByCountryName(input) ??
      DEFAULT_MARKET
    );
  }
  return resolveMarket(input);
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/** Coerce a possibly-string / possibly-null amount into a finite number (else null). */
function coerceAmount(amount: number | string | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = typeof amount === 'number' ? amount : Number(amount);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve a currency code + locale from a `MarketInput`. A bare string is
 * treated as a currency code first (so `formatCurrency(x, 'KES')` works), then
 * falls back to code/country lookup.
 */
function resolveCurrencyAndLocale(input?: MarketInput): { currency: string; locale: string } {
  if (typeof input === 'string') {
    const market = getMarketByCurrency(input) ?? getMarketByCode(input) ?? getMarketByCountryName(input);
    if (market) return { currency: market.currency, locale: market.locale };
    // Unknown but plausibly-valid ISO currency string — honor it with a neutral locale.
    return { currency: input.trim().toUpperCase() || DEFAULT_MARKET.currency, locale: 'en' };
  }
  const market = toMarket(input);
  return { currency: market.currency, locale: market.locale };
}

/**
 * Format a monetary amount in the given currency/market.
 *
 * @param amount            number | DecimalString | null | undefined. Null/undefined/NaN → treated as 0.
 * @param currencyCodeOrMarket  A currency code ('KES'), ISO country code ('KE'),
 *                          a Market object, or an org-like object. Defaults to KES.
 * @param options           Optional Intl.NumberFormat overrides (e.g. `{ notation: 'compact' }`).
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCodeOrMarket?: MarketInput,
  options?: Intl.NumberFormatOptions,
): string {
  const value = coerceAmount(amount) ?? 0;
  const { currency, locale } = resolveCurrencyAndLocale(currencyCodeOrMarket);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

/** Convenience: format an amount using an org's resolved market currency. */
export function formatCurrencyForOrg(
  amount: number | string | null | undefined,
  org?: MarketOrgLike | null,
  options?: Intl.NumberFormatOptions,
): string {
  return formatCurrency(amount, resolveMarket(org), options);
}

// ---------------------------------------------------------------------------
// Phone helpers (market-aware)
// ---------------------------------------------------------------------------

/** The dialing prefix (e.g. '+254') for a market/org/code input. */
export function dialCodeFor(input?: MarketInput): string {
  return toMarket(input).dialCode;
}

/**
 * Normalize a phone number to international E.164-ish form using the market's
 * dial code instead of a hardcoded +254. Permissive:
 *  - strips spaces, dashes, parentheses, dots
 *  - '+2547…' / '+2332…' kept as-is
 *  - '00254…' → '+254…'
 *  - leading '0' (national trunk) → dial code (e.g. '0712…' → '+254712…')
 *  - bare local digits without a leading 0 → prefixed with the dial code
 * Returns the cleaned string unchanged if it can't be confidently normalized.
 */
export function normalizePhone(input: string | null | undefined, market?: MarketInput): string {
  if (!input) return '';
  const dialCode = dialCodeFor(market);
  const dialDigits = dialCode.replace(/\D/g, '');

  let s = String(input).trim().replace(/[\s().-]/g, '');
  if (!s) return '';

  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return `+${s.slice(2)}`;
  // Already carries the country digits without a '+', e.g. '254712345678'.
  if (dialDigits && s.startsWith(dialDigits)) return `+${s}`;
  // National format with trunk 0, e.g. '0712345678'.
  if (s.startsWith('0')) return `${dialCode}${s.slice(1)}`;
  // Bare local number (no trunk, no country code).
  if (/^\d+$/.test(s)) return `${dialCode}${s}`;
  return s;
}

/**
 * Permissive, international-friendly phone validator. After normalizing to the
 * market's dial code it accepts any '+' followed by 7–15 digits (E.164 bounds).
 * Works for +254 and +233 alike; not tied to a single country's national length.
 */
export function isValidPhone(input: string | null | undefined, market?: MarketInput): boolean {
  const normalized = normalizePhone(input, market);
  return /^\+\d{7,15}$/.test(normalized);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Returns the Market for the currently logged-in organization.
 *
 * Reads the existing auth store (`useAuthStore`) to decide whether the user has
 * an org (platform admins do not), and fetches the org via the existing
 * `GET /organizations/me` endpoint (shared React-Query cache key
 * `['my-organization']`). While loading, for platform admins, or on any error,
 * it returns DEFAULT_MARKET (Kenya) so the UI always has a usable market.
 *
 * `isLoading` reflects only the org fetch for org users.
 */
export function useMarket(): { market: Market; isLoading: boolean } {
  const user = useAuthStore((s) => s.user);
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';
  // Only org-scoped users have an org market to resolve.
  const enabled = !!user && !isPlatformAdmin && !!user.organizationId;

  const { data, isLoading } = useQuery({
    queryKey: ['my-organization'],
    queryFn: () => api.getMyOrganization(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const market = resolveMarket(data as MarketOrgLike | undefined);
  return { market, isLoading: enabled && isLoading };
}
