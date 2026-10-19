/**
 * INSURANCE UNITS, PER MARKET — what the platform-admin unit screens need to know about a market
 * that the market registry (lib/market.ts) does not carry.
 *
 * An insurance unit is the geography a LIVESTOCK index is computed over: the forage-NDVI index is
 * cumulated per unit per season, and the unit carries the season's NDVI baseline, strike level and
 * premium rate per TLU. The model has no crop terms. So:
 *
 *   - A market whose catalogue lists no livestock (Ghana: livestock is hidden, `livestockEnabled`
 *     false) cannot have a unit created — there is no product the unit's terms would price.
 *   - The season names and months are the market's own. Kenya's IBLI seasons are LRLD (long
 *     rains / long dry, Mar–Sep) and SRSD (short rains / short dry, Oct–Feb). Ghana's crop
 *     seasons differ by zone — a single unimodal season in the north, MAJOR and MINOR in the
 *     south — and are listed so the screen can say so, not because a unit can carry them.
 *   - The actuarial defaults the form pre-fills are KENYAN figures (the 0.45 / 0.35 / 1,500 /
 *     15,000 the form always used, the last two in KES). They belong to Kenya only and are cleared
 *     when the operator switches market; carrying a KES rate into another currency would price a
 *     herd wrongly with a number nobody typed.
 */
import { DEFAULT_COUNTRY_CODE, MARKETS, SUPPORTED_COUNTRY_CODES, isSupportedCountry, type CountryCode } from './market';

export interface SeasonDef {
  code: string;
  name: string;
  /** Calendar window, where the methodology states one. */
  months?: string;
}

/** Livestock index seasons, per market. Absent for a market with no livestock product. */
export const LIVESTOCK_SEASONS: Partial<Record<CountryCode, readonly SeasonDef[]>> = {
  KE: [
    { code: 'LRLD', name: 'Long rains / long dry', months: 'Mar–Sep' },
    { code: 'SRSD', name: 'Short rains / short dry', months: 'Oct–Feb' },
  ],
};

/** Crop seasons, per market, where they differ from the livestock calendar. */
export const CROP_SEASONS: Partial<Record<CountryCode, readonly SeasonDef[]>> = {
  GH: [
    { code: 'MAIN', name: 'Main season (north, unimodal)' },
    { code: 'MAJOR', name: 'Major season (south)' },
    { code: 'MINOR', name: 'Minor season (south)' },
  ],
  // The hidden markets: exactly the backend's `seasonCodes` and window labels (markets.js), so
  // the three repos agree on the codes. All windows are INDICATIVE pending agronomist sign-off.
  UG: [
    { code: 'FIRST', name: 'First season (MAM rains)', months: 'Mar–Aug' },
    { code: 'SECOND', name: 'Second season (SOND rains)', months: 'Aug–Jan' },
    { code: 'NORTH', name: 'Northern single season', months: 'Apr–Oct' },
  ],
  TZ: [
    { code: 'MSIMU', name: 'Msimu (unimodal: central, southern, western)', months: 'Nov–Jul' },
    { code: 'MASIKA', name: 'Masika long rains (bimodal: north, north-east, coast, Lake)', months: 'Feb–Aug' },
    { code: 'VULI', name: 'Vuli short rains (bimodal)', months: 'Oct–Feb' },
  ],
  ZM: [{ code: 'MAIN', name: 'Main rainy season (unimodal)', months: 'Nov–Jun' }],
  NG: [
    { code: 'MAJOR_SOUTH', name: 'Main season (south, bimodal)', months: 'Mar–Aug' },
    { code: 'MINOR_SOUTH', name: 'Second season (south, bimodal)', months: 'Aug–Dec' },
    { code: 'MAJOR_NORTH', name: 'Main season (north, unimodal)', months: 'May–Nov' },
  ],
  RW: [
    { code: 'SEASON_A', name: 'Season A (short rains)', months: 'Sep–Feb' },
    { code: 'SEASON_B', name: 'Season B (long rains)', months: 'Mar–Jul' },
  ],
};

/** "LRLD — Long rains / long dry (Mar–Sep)"; the bare code where the market does not name it. */
export function seasonHeading(countryCode: string | null | undefined, code: string): string {
  const cc = isSupportedCountry(countryCode) ? (countryCode.trim().toUpperCase() as CountryCode) : null;
  const season = cc ? LIVESTOCK_SEASONS[cc]?.find((s) => s.code === code) : undefined;
  if (!season) return code;
  return `${season.code} — ${season.name}${season.months ? ` (${season.months})` : ''}`;
}

/** "LRLD (Mar–Sep)" for a table cell; the bare code where the market does not name it. */
export function seasonShortLabel(countryCode: string | null | undefined, code: string): string {
  const cc = isSupportedCountry(countryCode) ? (countryCode.trim().toUpperCase() as CountryCode) : null;
  const season = cc ? LIVESTOCK_SEASONS[cc]?.find((s) => s.code === code) : undefined;
  return season?.months ? `${season.code} (${season.months})` : code;
}

/** May a unit be created in this market? Only where the market sells livestock cover. */
export function livestockUnitsOffered(countryCode: string | null | undefined): boolean {
  return isSupportedCountry(countryCode) && MARKETS[countryCode.trim().toUpperCase() as CountryCode].livestockEnabled === true;
}

// ---------------------------------------------------------------------------
// UNIT CODE
// ---------------------------------------------------------------------------

/**
 * Markets whose unit codes MUST carry the country prefix: EVERY market except Kenya, matching the
 * backend's `requiredUnitCodePrefix` (it exempts only DEFAULT_COUNTRY_CODE). Kenya's legacy
 * codes predate the convention, so it is a hint there only. Derived rather than listed, so a new
 * market cannot be added without it.
 */
const REQUIRED_UNIT_CODE_PREFIX: Partial<Record<CountryCode, string>> = Object.fromEntries(
  SUPPORTED_COUNTRY_CODES.filter((cc) => cc !== DEFAULT_COUNTRY_CODE).map((cc) => [cc, `${cc}-`]),
);

export function unitCodePlaceholder(countryCode: CountryCode): string {
  return `${countryCode}-…`;
}

export function unitCodeHint(countryCode: CountryCode): string {
  const required = REQUIRED_UNIT_CODE_PREFIX[countryCode];
  return required
    ? `${MARKETS[countryCode].countryName} unit codes must start with ${required}`
    : `Unique code, conventionally ${countryCode}- followed by the ${MARKETS[countryCode].adminDivisionLabels.level1.toLowerCase()} code.`;
}

/** The validation message for a code that lacks its market's required prefix, else null. */
export function unitCodePrefixError(countryCode: CountryCode, unitCode: string): string | null {
  const required = REQUIRED_UNIT_CODE_PREFIX[countryCode];
  if (!required) return null;
  return unitCode.trim().toUpperCase().startsWith(required)
    ? null
    : `${MARKETS[countryCode].countryName} unit codes must start with ${required} (for example ${required}NP-01).`;
}

// ---------------------------------------------------------------------------
// MARKET DEFAULTS
// ---------------------------------------------------------------------------

export interface UnitActuarialValues {
  ndviBaselineLRLD?: number;
  ndviBaselineSRSD?: number;
  strikeLevelLRLD?: number;
  strikeLevelSRSD?: number;
  premiumRateLRLD?: number;
  premiumRateSRSD?: number;
  valuePerTLU?: number;
}

export const UNIT_ACTUARIAL_FIELDS = [
  'ndviBaselineLRLD',
  'ndviBaselineSRSD',
  'strikeLevelLRLD',
  'strikeLevelSRSD',
  'premiumRateLRLD',
  'premiumRateSRSD',
  'valuePerTLU',
] as const satisfies readonly (keyof UnitActuarialValues)[];

/** The form's pre-fill per market. Kenya only: no other market has livestock terms to pre-fill. */
const UNIT_DEFAULTS: Partial<Record<CountryCode, Required<UnitActuarialValues>>> = {
  KE: {
    ndviBaselineLRLD: 0.45,
    ndviBaselineSRSD: 0.45,
    strikeLevelLRLD: 0.35,
    strikeLevelSRSD: 0.35,
    premiumRateLRLD: 1500,
    premiumRateSRSD: 1500,
    valuePerTLU: 15000,
  },
};

/** Every actuarial field, set to the market's default or left empty. */
export function unitDefaultsFor(countryCode: CountryCode): UnitActuarialValues {
  const defaults = UNIT_DEFAULTS[countryCode];
  return Object.fromEntries(UNIT_ACTUARIAL_FIELDS.map((f) => [f, defaults?.[f]])) as UnitActuarialValues;
}

/**
 * The actuarial values after switching market `from` → `to`. A field still holding `from`'s
 * default (or empty) takes `to`'s default (or becomes empty); a figure the operator typed is
 * theirs and is kept. Returns only the fields that change.
 */
export function swapUnitDefaults(
  current: UnitActuarialValues,
  from: CountryCode,
  to: CountryCode,
): UnitActuarialValues {
  const before = UNIT_DEFAULTS[from];
  const after = UNIT_DEFAULTS[to];
  const changes: UnitActuarialValues = {};
  for (const field of UNIT_ACTUARIAL_FIELDS) {
    const value = current[field];
    const untouched = value === undefined || Number.isNaN(value) || value === before?.[field];
    if (untouched && value !== after?.[field]) changes[field] = after?.[field];
  }
  return changes;
}

export interface UnitFormValues extends UnitActuarialValues {
  county: string;
  subCounty: string;
  unitCode: string;
  country: CountryCode;
  bboxMinLon?: number;
  bboxMinLat?: number;
  bboxMaxLon?: number;
  bboxMaxLat?: number;
}

/**
 * A blank unit form FOR A MARKET: geography empty, livestock terms at that market's defaults.
 * Used both for the first render and for the reset after a successful create — which passes the
 * market just used, so the next unit starts in the same market instead of snapping back to the
 * registry default (the old `form.reset()` did that, silently re-selecting Kenya).
 */
export function blankUnitForm(country: CountryCode): UnitFormValues {
  return {
    county: '',
    subCounty: '',
    unitCode: '',
    country,
    bboxMinLon: undefined,
    bboxMinLat: undefined,
    bboxMaxLon: undefined,
    bboxMaxLat: undefined,
    ...unitDefaultsFor(country),
  };
}
