/**
 * MARKET — the dashboard mirror of microcrop-backend/src/config/markets.js.
 *
 * WHAT THIS REPLACES. The dashboard hardcoded Kenya in about thirty places: `const CURRENCY =
 * 'KES'`, `KES {amount}` in table cells, `+254712345678` placeholders, `/^(\+254|0)[17]\d{8}$/`
 * in the signup validator, "County"/"Sub-County" column headers, and "M-Pesa" as the name of
 * every mobile-money prompt. A Ghanaian partner — a market the backend has supported since the
 * GH entry landed in markets.js — was shown Kenyan currency on its own policies, told its valid
 * +233 number was invalid, and asked for a County it does not have.
 *
 * THE REGISTRY IS PRESENTATION ONLY, AND THAT IS A DELIBERATE LIMIT.
 *
 * The backend registry is the authority. It is deep-frozen at load, its consensus-relevant
 * subset is hashed into `marketsConsensusDigest()` and pinned by a test, and it decides things
 * with money consequences: the payment provider, the sum-insured bounds enforced inside the
 * purchase transaction, the KYB required-document set, whether livestock may be sold. NOTHING
 * here decides any of that. This file answers "what should this screen SAY", and the subset it
 * carries is the subset a screen needs to say it.
 *
 * In particular the two fields with the sharpest consequences are deliberately NOT mirrored as
 * authority:
 *
 *   KYB DOCUMENTS come from `GET /organizations/me/kyb` → `checklist`, built server-side by
 *   buildKybChecklist() off the org's own countryCode. A mirrored document list would be a
 *   second answer to "what must I upload", and the one the server enforces on submit would win
 *   — so the partner would be shown a list it could satisfy and still be refused.
 *
 *   SUM-INSURED BOUNDS are mirrored (they make a form hint possible) but are explicitly a HINT.
 *   policy.service asserts them inside the purchase transaction; a value this file accepts can
 *   still be refused, and the refusal is the truth.
 *
 * KEEPING IT IN SYNC. The literal below is checked by src/lib/__tests__/market.test.ts, which
 * pins the consensus-relevant subset as an explicit table. Editing a market here fails that
 * test; the only way to pass is to re-pin, which is the moment to re-read
 * microcrop-backend/src/config/markets.js and confirm the two agree. Cosmetic additions
 * (a label, a placeholder) are outside the pinned subset and do not cry wolf.
 *
 * FAIL-SOFT ON RESOLUTION, MATCHING THE BACKEND. `resolveMarket` defaults an unknown or absent
 * country code to Kenya, exactly as `resolveCountryCode` does server-side, because a legacy org
 * row with a null countryCode must not break a page. BUT the CALLERS that render money do NOT
 * get to default: see `MarketState` and `formatMoney(value, null)` below — guessing a currency
 * is a different and much worse failure than guessing a label.
 */

/**
 * ISO 3166-1 alpha-2 codes of the markets this build knows about.
 *
 * KE and GH are open. UG, TZ, ZM, NG and RW are CONFIGURED BUT HIDDEN (`signupOpen: false`): the
 * backend resolves them for organizations a platform admin created there, but a partner cannot
 * self-sign-up into them and their catalogues list nothing sellable.
 */
export type CountryCode = 'KE' | 'GH' | 'UG' | 'TZ' | 'ZM' | 'NG' | 'RW';

export interface Market {
  countryCode: CountryCode;
  countryName: string;
  /** ISO 4217. */
  currency: string;
  /** Local symbol, for prose. Tables prefer the code — see formatMoney. */
  currencySymbol: string;
  /**
   * Decimal places in the currency's ISO 4217 minor unit: 2 for KES, GHS, TZS, ZMW and NGN; 0 for
   * UGX and RWF, which have no minor unit. `formatMoney` never shows more decimals than this, so
   * a UGX premium cannot render as "UGX 2,640.37" — a fraction of a shilling nobody can pay.
   */
  currencyMinorExponent: number;
  /** E.164 country calling code, without the '+'. */
  phoneCountryCode: number;
  /** The backend's `phoneRegex`, as a compiled RegExp. Tests the full E.164 form. */
  phoneRegex: RegExp;
  /** A valid-looking full number, for a placeholder. Not a real subscriber. */
  phoneExample: string;
  /** The same number as a local dialling string, which is how partners actually type it. */
  phoneLocalExample: string;
  /**
   * What to CALL mobile money in this market. 'M-Pesa' is a Safaricom product name and is
   * meaningless in Ghana; the backend added `mobileMoneyLabel` for exactly this and the farmer
   * SMS copy already reads it.
   */
  mobileMoneyLabel: string;
  mobileMoneyNetworks: readonly string[];
  /**
   * Insurance regulator code. KE: IRA. GH: NIC. UG is also 'IRA' (the Insurance Regulatory
   * Authority of Uganda), as the backend has it; show it next to the country, never alone.
   */
  regulator: string;
  /**
   * What the two administrative-division columns are CALLED here. The columns are named
   * `county` / `subCounty` in the schema and stay named that — renaming live columns is
   * destructive and buys nothing — but a Ghanaian partner sees Region / District.
   */
  adminDivisionLabels: { level1: string; level2: string };
  /** Ghana v1 is crop-only. Gates the livestock/IBLI surfaces. */
  livestockEnabled: boolean;
  /** HINT ONLY. policy.service enforces these inside the purchase transaction. */
  minSumInsuredLocal: number;
  maxSumInsuredLocal: number;
  /**
   * May a partner SELF-SIGN-UP into this market? Mirrors the backend's non-consensus
   * `signupOpen`. false = configured but hidden: the signup picker leaves it out (the backend's
   * register-organization validator refuses it anyway), while platform-admin pickers, which may
   * deliberately onboard a design partner there, list it via `countryOptions({ includeHidden })`.
   */
  signupOpen: boolean;
}

export const DEFAULT_COUNTRY_CODE: CountryCode = 'KE';

const KE: Market = {
  countryCode: 'KE',
  countryName: 'Kenya',
  currency: 'KES',
  currencySymbol: 'KSh',
  currencyMinorExponent: 2,
  phoneCountryCode: 254,
  phoneRegex: /^\+254\d{9}$/,
  phoneExample: '+254712345678',
  phoneLocalExample: '0712345678',
  mobileMoneyLabel: 'M-Pesa',
  mobileMoneyNetworks: ['Safaricom'],
  regulator: 'IRA',
  adminDivisionLabels: { level1: 'County', level2: 'Sub-County' },
  livestockEnabled: true,
  minSumInsuredLocal: 1000,
  maxSumInsuredLocal: 1000000,
  signupOpen: true,
};

const GH: Market = {
  countryCode: 'GH',
  countryName: 'Ghana',
  currency: 'GHS',
  currencySymbol: 'GH₵',
  currencyMinorExponent: 2,
  phoneCountryCode: 233,
  phoneRegex: /^\+233\d{9}$/,
  phoneExample: '+233241234567',
  phoneLocalExample: '0241234567',
  mobileMoneyLabel: 'Mobile Money',
  mobileMoneyNetworks: ['MTN', 'AirtelTigo', 'Telecel'],
  regulator: 'NIC',
  adminDivisionLabels: { level1: 'Region', level2: 'District' },
  livestockEnabled: false,
  minSumInsuredLocal: 1000,
  maxSumInsuredLocal: 250000,
  signupOpen: true,
};

// ---------------------------------------------------------------------------
// HIDDEN MARKETS. Configured, not open: `signupOpen: false`, no livestock, and a backend
// catalogue in which every crop is COMING_SOON. The sum-insured bounds are the backend's
// INDICATIVE figures (about USD 8 to USD 8,000; Nigeria capped at the NAICOM micro-insurance
// ₦2m). The phone regexes are the backend's loose `^\+CC\d{N}$` forms.
// ---------------------------------------------------------------------------

const UG: Market = {
  countryCode: 'UG',
  countryName: 'Uganda',
  currency: 'UGX',
  currencySymbol: 'USh',
  // ISO 4217: no minor unit.
  currencyMinorExponent: 0,
  phoneCountryCode: 256,
  phoneRegex: /^\+256\d{9}$/,
  phoneExample: '+256770000123',
  phoneLocalExample: '0770000123',
  mobileMoneyLabel: 'Mobile Money',
  mobileMoneyNetworks: ['MTN', 'Airtel'],
  regulator: 'IRA',
  adminDivisionLabels: { level1: 'District', level2: 'Sub-county' },
  livestockEnabled: false,
  minSumInsuredLocal: 30000,
  maxSumInsuredLocal: 30000000,
  signupOpen: false,
};

const TZ: Market = {
  countryCode: 'TZ',
  countryName: 'Tanzania',
  currency: 'TZS',
  currencySymbol: 'TSh',
  // ISO 4217 is 2 (100 senti), even though the rails move whole shillings.
  currencyMinorExponent: 2,
  phoneCountryCode: 255,
  phoneRegex: /^\+255\d{9}$/,
  phoneExample: '+255754000000',
  phoneLocalExample: '0754000000',
  mobileMoneyLabel: 'Mobile Money',
  mobileMoneyNetworks: ['Vodacom', 'Airtel', 'Tigo', 'Halotel'],
  regulator: 'TIRA',
  adminDivisionLabels: { level1: 'Region', level2: 'District' },
  livestockEnabled: false,
  minSumInsuredLocal: 20000,
  maxSumInsuredLocal: 20000000,
  signupOpen: false,
};

const ZM: Market = {
  countryCode: 'ZM',
  countryName: 'Zambia',
  currency: 'ZMW',
  currencySymbol: 'K',
  currencyMinorExponent: 2,
  phoneCountryCode: 260,
  phoneRegex: /^\+260\d{9}$/,
  phoneExample: '+260970000001',
  phoneLocalExample: '0970000001',
  mobileMoneyLabel: 'Mobile Money',
  mobileMoneyNetworks: ['MTN', 'Airtel', 'Zamtel'],
  regulator: 'PIA',
  adminDivisionLabels: { level1: 'Province', level2: 'District' },
  livestockEnabled: false,
  minSumInsuredLocal: 200,
  maxSumInsuredLocal: 200000,
  signupOpen: false,
};

const NG: Market = {
  countryCode: 'NG',
  countryName: 'Nigeria',
  currency: 'NGN',
  currencySymbol: '₦',
  currencyMinorExponent: 2,
  phoneCountryCode: 234,
  phoneRegex: /^\+234\d{10}$/,
  phoneExample: '+2348030000001',
  phoneLocalExample: '08030000001',
  // PLACEHOLDER, as in the backend: Nigeria has no mobile-money rail with our provider (payout is
  // to bank accounts only), so nothing here may be read as a network a payment prompt can use.
  mobileMoneyLabel: 'Bank account',
  mobileMoneyNetworks: ['BANK'],
  regulator: 'NAICOM',
  adminDivisionLabels: { level1: 'State', level2: 'Local Government Area' },
  livestockEnabled: false,
  minSumInsuredLocal: 15000,
  maxSumInsuredLocal: 2000000,
  signupOpen: false,
};

const RW: Market = {
  countryCode: 'RW',
  countryName: 'Rwanda',
  currency: 'RWF',
  currencySymbol: 'FRw',
  // ISO 4217: no minor unit.
  currencyMinorExponent: 0,
  phoneCountryCode: 250,
  phoneRegex: /^\+250\d{9}$/,
  phoneExample: '+250788000001',
  phoneLocalExample: '0788000001',
  mobileMoneyLabel: 'Mobile Money',
  mobileMoneyNetworks: ['MTN', 'Airtel'],
  regulator: 'BNR',
  adminDivisionLabels: { level1: 'Province', level2: 'District' },
  livestockEnabled: false,
  minSumInsuredLocal: 12000,
  maxSumInsuredLocal: 12000000,
  signupOpen: false,
};

export const MARKETS: Readonly<Record<CountryCode, Market>> = Object.freeze({ KE, GH, UG, TZ, ZM, NG, RW });

/**
 * Every supported code, in the order a country picker should list them: the open markets first,
 * in their existing order, so the single-market default on platform screens stays Kenya.
 */
export const SUPPORTED_COUNTRY_CODES: readonly CountryCode[] = Object.freeze([
  'KE', 'GH', 'UG', 'TZ', 'ZM', 'NG', 'RW',
]);

/** The codes a partner may self-sign-up into (`signupOpen`), in registry order. */
export const SIGNUP_COUNTRY_CODES: readonly CountryCode[] = Object.freeze(
  SUPPORTED_COUNTRY_CODES.filter((code) => MARKETS[code].signupOpen),
);

export function isSupportedCountry(code: unknown): code is CountryCode {
  return typeof code === 'string' && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

/**
 * Resolve a country code to a market, defaulting rather than throwing — the same fail-soft
 * behaviour as `resolveCountryCode` in the backend, for the same reason: a legacy organization
 * row with a null `countryCode` must not break a page.
 *
 * Use this for LABELS. For money, prefer `marketOrNull` + `formatMoney`, which refuse to guess.
 */
export function resolveMarket(code: unknown): Market {
  if (isSupportedCountry(code)) return MARKETS[code.trim().toUpperCase() as CountryCode];
  return MARKETS[DEFAULT_COUNTRY_CODE];
}

/** The market for a code, or null when the code is absent or unrecognised. Never guesses. */
export function marketOrNull(code: unknown): Market | null {
  return isSupportedCountry(code) ? MARKETS[code.trim().toUpperCase() as CountryCode] : null;
}

/**
 * THREE-VALUED, for the same reason `TierState` is (see lib/tier.ts), and the three values mean
 * the same things:
 *
 *   'loading'  the organization has not resolved. Render a skeleton, or an amount with no
 *              currency token. Rendering 'KES' here is the flash-of-wrong-state bug — a Ghanaian
 *              partner would see Kenyan shillings on its own policies for a beat on every page
 *              load, which reads as a data fault in a money figure.
 *   'unknown'  the organization resolved but carries no country we recognise, or the request
 *              failed. Say the amount, do NOT name a currency we cannot confirm. A wrong
 *              currency symbol on a premium is worse than an unlabelled number: the number is
 *              merely incomplete, the symbol is a false statement about money.
 *   'known'    we have the market.
 */
export type MarketState = 'loading' | 'unknown' | 'known';

export function resolveMarketState(
  countryCode: string | null | undefined,
  isLoading: boolean,
  hasOrganization: boolean,
): MarketState {
  // Loading wins only while there is no organization at all: a background refetch must not knock
  // a resolved answer back to 'loading', or every window focus re-flashes every money figure.
  if (!hasOrganization) return isLoading ? 'loading' : 'unknown';
  return isSupportedCountry(countryCode) ? 'known' : 'unknown';
}

// ---------------------------------------------------------------------------
// MONEY
// ---------------------------------------------------------------------------

/**
 * Format a major-unit amount for display.
 *
 * `market === null` is the honest-unknown case and renders the GROUPED NUMBER WITH NO CURRENCY
 * TOKEN. It does not fall back to KES. Every caller that formats money reaches this function, so
 * this one line is what guarantees the dashboard never asserts a currency it has not confirmed.
 *
 * `options.decimals` is capped at the market's `currencyMinorExponent`.
 *
 * Grouping uses `en-US` separators deliberately rather than a locale derived from the market:
 * every market groups thousands with a comma and uses a dot for the decimal, and deriving
 * a locale from a country code would silently change the separator for a future market without
 * anyone deciding to.
 */
export function formatMoney(
  value: number | string | null | undefined,
  market: Market | null,
  options: { symbol?: boolean; decimals?: number } = {},
): string {
  const n = value === null || value === undefined || value === '' ? 0 : Number(value);
  if (!Number.isFinite(n)) return market ? `${moneyToken(market, options.symbol)} —` : '—';

  // Never more decimals than the currency has: a 0-exponent currency (UGX, RWF) asked for two
  // still renders whole units, because a fraction of one is an amount nobody can pay or be paid.
  const requested = options.decimals ?? 0;
  const decimals = market ? Math.min(requested, market.currencyMinorExponent) : requested;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return market ? `${moneyToken(market, options.symbol)} ${formatted}` : formatted;
}

function moneyToken(market: Market, symbol?: boolean): string {
  return symbol ? market.currencySymbol : market.currency;
}

/**
 * The currency token for a label like "Sum insured (KES)". Returns null when the market is
 * unknown, so a caller renders "Sum insured" rather than "Sum insured (KES)" on a partner whose
 * currency we have not confirmed.
 */
export function currencyLabel(market: Market | null): string | null {
  return market ? market.currency : null;
}

/** "Sum insured" -> "Sum insured (KES)", or "Sum insured" when the market is unknown. */
export function withCurrencySuffix(label: string, market: Market | null): string {
  return market ? `${label} (${market.currency})` : label;
}

/**
 * Compact money for a stat tile ("KES 1.2M"). Same null contract as formatMoney.
 *
 * `Intl.NumberFormat` is given the currency only when we have one; the old call sites passed
 * `{ style: 'currency', currency: 'KES' }` unconditionally, which is where most of the
 * hardcoded Kenya in the money figures lived.
 */
export function formatMoneyCompact(
  value: number | string | null | undefined,
  market: Market | null,
): string {
  const n = value === null || value === undefined || value === '' ? 0 : Number(value);
  if (!Number.isFinite(n)) return '—';

  if (!market) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: market.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

// ---------------------------------------------------------------------------
// PHONE
// ---------------------------------------------------------------------------

/**
 * Normalise a typed number to the E.164 form the backend's `phoneRegex` requires.
 *
 * Accepts what people actually type: `0712345678`, `712345678`, `254712345678`, `+254 712 345
 * 678`. Returns the input trimmed of whitespace when it cannot be improved — this function
 * NEVER rejects, because rejecting is the validator's job and a normaliser that returns
 * undefined on bad input makes the error message disappear.
 */
export function normalizePhoneForMarket(
  input: string | null | undefined,
  market: Market | null,
): string | undefined {
  if (input === null || input === undefined) return undefined;
  const raw = input.replace(/[\s()-]/g, '');
  if (!raw) return undefined;
  if (!market) return raw;

  const cc = String(market.phoneCountryCode);
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith(cc)) return `+${raw}`;
  // A single leading zero is the local trunk prefix in every supported market.
  if (raw.startsWith('0')) return `+${cc}${raw.slice(1)}`;
  return `+${cc}${raw}`;
}

/** Does this number belong to this market? Fail-closed on a null market. */
export function isValidPhoneForMarket(
  input: string | null | undefined,
  market: Market | null,
): boolean {
  if (!market) return false;
  const normalized = normalizePhoneForMarket(input, market);
  return Boolean(normalized) && market.phoneRegex.test(normalized as string);
}

/** Does this number belong to ANY supported market? For forms with no market in hand. */
export function isValidPhoneForAnyMarket(input: string | null | undefined): boolean {
  if (!input) return false;
  const raw = input.replace(/[\s()-]/g, '');
  return SUPPORTED_COUNTRY_CODES.some((code) => MARKETS[code].phoneRegex.test(raw));
}

/**
 * The message a phone field should show when the number is not this market's. With no market in
 * hand it gives the OPEN markets' examples only: they are examples, not the accepted set, and a
 * hint that listed hidden markets would advertise countries a partner cannot sign up in.
 */
export function phoneHint(market: Market | null): string {
  if (!market) {
    const examples = SIGNUP_COUNTRY_CODES.map((c) => MARKETS[c].phoneExample).join(' or ');
    return `Include the country code, for example ${examples}.`;
  }
  return `${market.countryName} number — ${market.phoneExample}, or ${market.phoneLocalExample}.`;
}

// ---------------------------------------------------------------------------
// LABELS
// ---------------------------------------------------------------------------

/**
 * What to call the `county` column on this org's screens. Defaults to the Kenyan label when the
 * market is unknown — a label is the one place guessing is acceptable, because being wrong says
 * "County" to a Ghanaian rather than making a false claim about money.
 */
export function level1Label(market: Market | null): string {
  return (market ?? MARKETS[DEFAULT_COUNTRY_CODE]).adminDivisionLabels.level1;
}

/** What to call the `subCounty` column. Same defaulting rationale as level1Label. */
export function level2Label(market: Market | null): string {
  return (market ?? MARKETS[DEFAULT_COUNTRY_CODE]).adminDivisionLabels.level2;
}

/**
 * What to call the mobile-money prompt. Falls back to the neutral 'mobile money' rather than
 * 'M-Pesa' — a product name is a factual claim about which network is being used, and the wrong
 * one tells a Ghanaian farmer to check an app they do not have.
 */
export function mobileMoneyLabel(market: Market | null): string {
  return market ? market.mobileMoneyLabel : 'mobile money';
}

/**
 * Country options for a picker, in registry order.
 *
 * Open markets only by default — the self-signup picker must not offer a market the backend
 * refuses at register-organization. Platform-admin pickers pass `includeHidden: true`: an
 * operator may deliberately create an organization in a hidden market (the backend's admin create
 * path accepts every supported market).
 */
export function countryOptions(
  { includeHidden = false }: { includeHidden?: boolean } = {},
): { value: CountryCode; label: string }[] {
  return SUPPORTED_COUNTRY_CODES.filter((value) => includeHidden || MARKETS[value].signupOpen).map(
    (value) => ({ value, label: MARKETS[value].countryName }),
  );
}
