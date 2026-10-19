/**
 * THE MARKET REGISTRY AND ITS ONE NON-NEGOTIABLE RULE: never assert a currency we have not
 * confirmed.
 *
 * What this file pins, in the order the risks matter:
 *
 *   1. MONEY NEVER GUESSES. `formatMoney(value, null)` renders the number with NO currency
 *      token. Every money figure in the dashboard reaches that function, so this one property is
 *      what guarantees a Ghanaian partner is never shown its own premiums labelled KES — which
 *      is a false statement about money, not merely a cosmetic defect. The old code was
 *      `KES ${amount}` inlined in about a dozen places and a fallback would have been invisible.
 *
 *   2. THE STATE IS THREE-VALUED, and 'loading' never resolves to a currency. A background
 *      refetch must not knock a resolved answer back to 'loading' either, or every money figure
 *      re-flashes on window focus.
 *
 *   3. PHONE NORMALISATION IS PER-MARKET. The old normaliser prefixed `+254` unconditionally, so
 *      a Ghanaian `0241234567` became `+254241234567` — a syntactically valid Kenyan number
 *      belonging to nobody, stored and later used for a payment prompt.
 *
 *   4. THE MIRROR MATCHES THE BACKEND. The consensus-relevant subset is pinned as an explicit
 *      table. Editing a market fails this test; the only way to pass is to re-pin, which is the
 *      moment to re-read microcrop-backend/src/config/markets.js and confirm the two agree.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COUNTRY_CODE,
  MARKETS,
  SIGNUP_COUNTRY_CODES,
  SUPPORTED_COUNTRY_CODES,
  countryOptions,
  currencyLabel,
  formatMoney,
  formatMoneyCompact,
  isSupportedCountry,
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  level1Label,
  level2Label,
  marketOrNull,
  mobileMoneyLabel,
  normalizePhoneForMarket,
  phoneHint,
  resolveMarket,
  resolveMarketState,
  withCurrencySuffix,
} from '@/lib/market';

const KE = MARKETS.KE;
const GH = MARKETS.GH;

describe('money never asserts a currency it has not confirmed', () => {
  it('formats with NO currency token when the market is null', () => {
    expect(formatMoney(16500, null)).toBe('16,500');
    expect(formatMoney(16500, null)).not.toContain('KES');
    expect(formatMoney(16500, null)).not.toContain('KSh');
  });

  it('does not fall back to the default market when the market is null', () => {
    // The fail-soft default exists for LABELS. If it ever leaked into money formatting, this
    // would read "KES 16,500" for an organization whose currency is unknown.
    expect(formatMoney(16500, null)).not.toBe(formatMoney(16500, KE));
  });

  it('formats in the market currency when the market is known', () => {
    expect(formatMoney(16500, KE)).toBe('KES 16,500');
    expect(formatMoney(16500, GH)).toBe('GHS 16,500');
  });

  it('can use the local symbol for prose', () => {
    expect(formatMoney(16500, KE, { symbol: true })).toBe('KSh 16,500');
    expect(formatMoney(16500, GH, { symbol: true })).toBe('GH₵ 16,500');
  });

  it('accepts a Prisma Decimal string without mangling it', () => {
    // Decimal columns serialize to strings on the wire; a naive `.toLocaleString()` on a string
    // returns the string unchanged and silently drops the grouping.
    expect(formatMoney('16500', KE)).toBe('KES 16,500');
    expect(formatMoney('16500.00', KE)).toBe('KES 16,500');
  });

  it('renders zero as zero rather than as missing', () => {
    expect(formatMoney(0, KE)).toBe('KES 0');
    expect(formatMoney(null, KE)).toBe('KES 0');
    expect(formatMoney(undefined, KE)).toBe('KES 0');
  });

  it('renders a dash for a non-numeric value instead of NaN', () => {
    expect(formatMoney('not-a-number', KE)).toBe('KES —');
    expect(formatMoney('not-a-number', null)).toBe('—');
  });

  it('honours an explicit decimal count', () => {
    expect(formatMoney(16500.5, KE, { decimals: 2 })).toBe('KES 16,500.50');
  });

  it('never shows more decimals than the currency has (UGX and RWF have none)', () => {
    // A fraction of a shilling is an amount nobody can pay: asking for two decimals in a
    // 0-exponent currency still renders whole units.
    expect(formatMoney(2640.37, MARKETS.UG, { decimals: 2 })).toBe('UGX 2,640');
    expect(formatMoney(1512.5, MARKETS.RW, { decimals: 2 })).toBe('RWF 1,513');
    expect(formatMoney(30000000, MARKETS.UG)).toBe('UGX 30,000,000');
    expect(formatMoney(1512.5, MARKETS.RW, { symbol: true })).toBe('FRw 1,513');
    // 2-exponent markets are unchanged, hidden or open.
    expect(formatMoney(1512.5, MARKETS.TZ, { decimals: 2 })).toBe('TZS 1,512.50');
    expect(formatMoney(1512.5, MARKETS.NG, { decimals: 2, symbol: true })).toBe('₦ 1,512.50');
    // With no market there is no exponent to cap at; the caller's count stands.
    expect(formatMoney(1512.5, null, { decimals: 2 })).toBe('1,512.50');
  });

  it('compact-formats a 0-exponent currency', () => {
    expect(formatMoneyCompact(1_200_000, MARKETS.UG)).toMatch(/UGX|USh/);
    expect(formatMoneyCompact(1_200_000, MARKETS.RW)).toMatch(/1\.2M/);
  });

  it('compact formatting obeys the same null contract', () => {
    expect(formatMoneyCompact(1_200_000, KE)).toMatch(/KES/);
    const unknown = formatMoneyCompact(1_200_000, null);
    expect(unknown).not.toMatch(/KES|KSh|GHS/);
    expect(unknown).toMatch(/1\.2M/);
  });

  it('currencyLabel and withCurrencySuffix omit the currency when unknown', () => {
    expect(currencyLabel(null)).toBeNull();
    expect(currencyLabel(GH)).toBe('GHS');
    expect(withCurrencySuffix('Sum insured', null)).toBe('Sum insured');
    expect(withCurrencySuffix('Sum insured', GH)).toBe('Sum insured (GHS)');
  });
});

describe('resolveMarketState — three-valued, and loading decides nothing', () => {
  it('is loading only while there is no organization and a request is in flight', () => {
    expect(resolveMarketState(undefined, true, false)).toBe('loading');
  });

  it('is unknown — not loading — once the request settles with no organization', () => {
    expect(resolveMarketState(undefined, false, false)).toBe('unknown');
  });

  it('does NOT return to loading on a background refetch once an organization is in hand', () => {
    // This is the flicker guard: `isLoading` is true during a refetch, and a state that keyed on
    // it alone would re-blank every money figure on each window focus.
    expect(resolveMarketState('KE', true, true)).toBe('known');
  });

  it('is unknown for a country this build does not recognise', () => {
    expect(resolveMarketState('ZZ', false, true)).toBe('unknown');
    expect(resolveMarketState('', false, true)).toBe('unknown');
    expect(resolveMarketState(null, false, true)).toBe('unknown');
  });

  it('is known for every supported market', () => {
    for (const code of SUPPORTED_COUNTRY_CODES) {
      expect(resolveMarketState(code, false, true)).toBe('known');
    }
  });
});

describe('marketOrNull vs resolveMarket — guessing is allowed in exactly one of them', () => {
  it('marketOrNull never guesses', () => {
    expect(marketOrNull('ZZ')).toBeNull();
    expect(marketOrNull(null)).toBeNull();
    expect(marketOrNull(undefined)).toBeNull();
    expect(marketOrNull('')).toBeNull();
    expect(marketOrNull(254)).toBeNull();
  });

  it('marketOrNull resolves a supported code, case- and whitespace-insensitively', () => {
    expect(marketOrNull('gh')).toBe(GH);
    expect(marketOrNull(' GH ')).toBe(GH);
  });

  it('resolveMarket defaults, matching the backend resolveCountryCode', () => {
    expect(resolveMarket('ZZ')).toBe(MARKETS[DEFAULT_COUNTRY_CODE]);
    expect(resolveMarket(null)).toBe(MARKETS[DEFAULT_COUNTRY_CODE]);
    expect(resolveMarket('GH')).toBe(GH);
  });

  it('isSupportedCountry rejects non-strings and unknown codes', () => {
    expect(isSupportedCountry('KE')).toBe(true);
    expect(isSupportedCountry('ke')).toBe(true);
    expect(isSupportedCountry('ZZ')).toBe(false);
    expect(isSupportedCountry(undefined)).toBe(false);
    expect(isSupportedCountry(254)).toBe(false);
  });
});

describe('phone normalisation is per-market', () => {
  it('prefixes the MARKET country code, not +254', () => {
    expect(normalizePhoneForMarket('0241234567', GH)).toBe('+233241234567');
    expect(normalizePhoneForMarket('0712345678', KE)).toBe('+254712345678');
  });

  it('is the regression test for the hardcoded normaliser', () => {
    // The old implementation produced '+254241234567' for this input: a valid-looking Kenyan
    // number for a Ghanaian subscriber, which a payment prompt would later be sent to.
    expect(normalizePhoneForMarket('0241234567', GH)).not.toBe('+254241234567');
  });

  it('leaves an already-E.164 number alone', () => {
    expect(normalizePhoneForMarket('+233241234567', GH)).toBe('+233241234567');
  });

  it('accepts a number typed with the country code but no plus', () => {
    expect(normalizePhoneForMarket('233241234567', GH)).toBe('+233241234567');
    expect(normalizePhoneForMarket('254712345678', KE)).toBe('+254712345678');
  });

  it('strips the spacing and punctuation people actually type', () => {
    expect(normalizePhoneForMarket('+254 712 345 678', KE)).toBe('+254712345678');
    expect(normalizePhoneForMarket('(024) 123-4567', GH)).toBe('+233241234567');
  });

  it('returns undefined for nothing, and never throws on bad input', () => {
    expect(normalizePhoneForMarket(undefined, KE)).toBeUndefined();
    expect(normalizePhoneForMarket(null, KE)).toBeUndefined();
    expect(normalizePhoneForMarket('   ', KE)).toBeUndefined();
  });

  it('passes the input through unchanged when there is no market to normalise against', () => {
    // It must not reject: rejecting is the validator's job, and a normaliser that returns
    // undefined makes the field's error message disappear.
    expect(normalizePhoneForMarket('0712345678', null)).toBe('0712345678');
  });
});

describe('phone validation is per-market, and fails closed', () => {
  it("accepts the market's own numbers", () => {
    expect(isValidPhoneForMarket('+254712345678', KE)).toBe(true);
    expect(isValidPhoneForMarket('0712345678', KE)).toBe(true);
    expect(isValidPhoneForMarket('+233241234567', GH)).toBe(true);
  });

  it("rejects another market's number", () => {
    // The backend's service layer refuses this; catching it client-side is what stops a Kenyan
    // organization storing a Ghanaian number.
    expect(isValidPhoneForMarket('+233241234567', KE)).toBe(false);
    expect(isValidPhoneForMarket('+254712345678', GH)).toBe(false);
  });

  it('rejects a wrong-length number in the right market', () => {
    expect(isValidPhoneForMarket('+25471234', KE)).toBe(false);
    expect(isValidPhoneForMarket('+2547123456789', KE)).toBe(false);
  });

  it('fails closed on a null market', () => {
    expect(isValidPhoneForMarket('+254712345678', null)).toBe(false);
  });

  it('isValidPhoneForAnyMarket accepts every supported market and nothing else', () => {
    expect(isValidPhoneForAnyMarket('+254712345678')).toBe(true);
    expect(isValidPhoneForAnyMarket('+233241234567')).toBe(true);
    expect(isValidPhoneForAnyMarket('+15551234567')).toBe(false);
    expect(isValidPhoneForAnyMarket('')).toBe(false);
    expect(isValidPhoneForAnyMarket(undefined)).toBe(false);
  });

  it('phoneHint names every OPEN market when there is none in hand, and no hidden one', () => {
    const hint = phoneHint(null);
    expect(hint).toBe(`Include the country code, for example ${KE.phoneExample} or ${GH.phoneExample}.`);
    for (const code of ['UG', 'TZ', 'ZM', 'NG', 'RW'] as const) {
      expect(hint).not.toContain(MARKETS[code].phoneExample);
    }
  });

  it("validates each hidden market's numbers against its own plan", () => {
    expect(isValidPhoneForMarket('0770000123', MARKETS.UG)).toBe(true);
    expect(normalizePhoneForMarket('0770000123', MARKETS.UG)).toBe('+256770000123');
    expect(isValidPhoneForMarket('08030000001', MARKETS.NG)).toBe(true);
    expect(isValidPhoneForMarket('+234803000000', MARKETS.NG)).toBe(false); // NG has a 10-digit NSN
    expect(isValidPhoneForMarket('+256770000123', MARKETS.RW)).toBe(false);
    expect(phoneHint(MARKETS.TZ)).toBe('Tanzania number — +255754000000, or 0754000000.');
  });

  it('isValidPhoneForAnyMarket accepts a hidden market number, as the backend anyMarketPhone does', () => {
    expect(isValidPhoneForAnyMarket('+260970000001')).toBe(true);
  });

  it('phoneHint names the one market when there is one', () => {
    expect(phoneHint(GH)).toContain('Ghana');
    expect(phoneHint(GH)).toContain(GH.phoneExample);
    expect(phoneHint(GH)).not.toContain('+254');
  });
});

describe('labels may default; money may not', () => {
  it('uses the market division labels when known', () => {
    expect(level1Label(KE)).toBe('County');
    expect(level2Label(KE)).toBe('Sub-County');
    expect(level1Label(GH)).toBe('Region');
    expect(level2Label(GH)).toBe('District');
  });

  it('falls back to the default market for an unknown market — a label, not a claim about money', () => {
    expect(level1Label(null)).toBe('County');
    expect(level2Label(null)).toBe('Sub-County');
  });

  it('never calls mobile money "M-Pesa" when the market is unknown', () => {
    // A product name is a factual claim about which network is being used, and the wrong one
    // tells a Ghanaian farmer to check an app they do not have.
    expect(mobileMoneyLabel(null)).toBe('mobile money');
    expect(mobileMoneyLabel(KE)).toBe('M-Pesa');
    expect(mobileMoneyLabel(GH)).toBe('Mobile Money');
  });

  it('labels the hidden markets with their own divisions and mobile-money wording', () => {
    expect([level1Label(MARKETS.UG), level2Label(MARKETS.UG)]).toEqual(['District', 'Sub-county']);
    expect([level1Label(MARKETS.TZ), level2Label(MARKETS.TZ)]).toEqual(['Region', 'District']);
    expect([level1Label(MARKETS.ZM), level2Label(MARKETS.ZM)]).toEqual(['Province', 'District']);
    expect([level1Label(MARKETS.NG), level2Label(MARKETS.NG)]).toEqual(['State', 'Local Government Area']);
    expect([level1Label(MARKETS.RW), level2Label(MARKETS.RW)]).toEqual(['Province', 'District']);
    // Nigeria has no mobile-money rail; the label must not claim one.
    expect(mobileMoneyLabel(MARKETS.NG)).toBe('Bank account');
  });

  it('countryOptions lists only the OPEN markets by default — the self-signup picker', () => {
    expect(countryOptions()).toEqual([
      { value: 'KE', label: 'Kenya' },
      { value: 'GH', label: 'Ghana' },
    ]);
  });

  it('countryOptions({ includeHidden: true }) lists every market in registry order — the admin pickers', () => {
    expect(countryOptions({ includeHidden: true })).toEqual([
      { value: 'KE', label: 'Kenya' },
      { value: 'GH', label: 'Ghana' },
      { value: 'UG', label: 'Uganda' },
      { value: 'TZ', label: 'Tanzania' },
      { value: 'ZM', label: 'Zambia' },
      { value: 'NG', label: 'Nigeria' },
      { value: 'RW', label: 'Rwanda' },
    ]);
  });

  it('SIGNUP_COUNTRY_CODES is exactly the signupOpen markets', () => {
    expect([...SIGNUP_COUNTRY_CODES]).toEqual(['KE', 'GH']);
    expect(SUPPORTED_COUNTRY_CODES.filter((c) => MARKETS[c].signupOpen)).toEqual([...SIGNUP_COUNTRY_CODES]);
  });
});

describe('the mirror matches microcrop-backend/src/config/markets.js', () => {
  /**
   * The consensus-relevant subset, pinned explicitly.
   *
   * Editing a market above fails this test. The only way to make it pass is to change the table
   * here too — which is the moment to open the backend registry and confirm the two still agree,
   * and to ask whether the change needs a methodologyVersion bump. Cosmetic fields (labels,
   * placeholders) are deliberately OUTSIDE this table so they do not cry wolf.
   */
  const PINNED = {
    KE: {
      countryName: 'Kenya',
      currency: 'KES',
      currencySymbol: 'KSh',
      currencyMinorExponent: 2,
      phoneCountryCode: 254,
      regulator: 'IRA',
      livestockEnabled: true,
      minSumInsuredLocal: 1000,
      maxSumInsuredLocal: 1000000,
    },
    GH: {
      countryName: 'Ghana',
      currency: 'GHS',
      currencySymbol: 'GH₵',
      currencyMinorExponent: 2,
      phoneCountryCode: 233,
      regulator: 'NIC',
      // Ghana v1 is crop-only. The backend ANDs the livestock capability with this flag, so a
      // `true` here would make the dashboard offer a product the server refuses.
      livestockEnabled: false,
      minSumInsuredLocal: 1000,
      maxSumInsuredLocal: 250000,
    },
    // CONFIGURED BUT HIDDEN. `signupOpen` is non-consensus server-side but pinned here because it
    // decides what the signup picker offers.
    UG: {
      countryName: 'Uganda',
      currency: 'UGX',
      currencySymbol: 'USh',
      currencyMinorExponent: 0,
      phoneCountryCode: 256,
      regulator: 'IRA',
      livestockEnabled: false,
      minSumInsuredLocal: 30000,
      maxSumInsuredLocal: 30000000,
      signupOpen: false,
    },
    TZ: {
      countryName: 'Tanzania',
      currency: 'TZS',
      currencySymbol: 'TSh',
      currencyMinorExponent: 2,
      phoneCountryCode: 255,
      regulator: 'TIRA',
      livestockEnabled: false,
      minSumInsuredLocal: 20000,
      maxSumInsuredLocal: 20000000,
      signupOpen: false,
    },
    ZM: {
      countryName: 'Zambia',
      currency: 'ZMW',
      currencySymbol: 'K',
      currencyMinorExponent: 2,
      phoneCountryCode: 260,
      regulator: 'PIA',
      livestockEnabled: false,
      minSumInsuredLocal: 200,
      maxSumInsuredLocal: 200000,
      signupOpen: false,
    },
    NG: {
      countryName: 'Nigeria',
      currency: 'NGN',
      currencySymbol: '₦',
      currencyMinorExponent: 2,
      phoneCountryCode: 234,
      regulator: 'NAICOM',
      livestockEnabled: false,
      minSumInsuredLocal: 15000,
      maxSumInsuredLocal: 2000000,
      signupOpen: false,
    },
    RW: {
      countryName: 'Rwanda',
      currency: 'RWF',
      currencySymbol: 'FRw',
      currencyMinorExponent: 0,
      phoneCountryCode: 250,
      regulator: 'BNR',
      livestockEnabled: false,
      minSumInsuredLocal: 12000,
      maxSumInsuredLocal: 12000000,
      signupOpen: false,
    },
  } as const;

  it('declares exactly the markets the backend declares', () => {
    expect([...SUPPORTED_COUNTRY_CODES]).toEqual(['KE', 'GH', 'UG', 'TZ', 'ZM', 'NG', 'RW']);
    expect(Object.keys(MARKETS).sort()).toEqual(Object.keys(PINNED).sort());
  });

  it.each(Object.keys(PINNED) as (keyof typeof PINNED)[])(
    'pins the consensus-relevant fields for %s',
    (code) => {
      expect(MARKETS[code]).toMatchObject(PINNED[code]);
    },
  );

  it('defaults to Kenya, as the backend DEFAULT_COUNTRY_CODE does', () => {
    expect(DEFAULT_COUNTRY_CODE).toBe('KE');
  });

  it('carries only 0- or 2-exponent currencies', () => {
    // ISO 4217: UGX and RWF have no minor unit; every other market's currency has two. The
    // backend accepts exactly these two (an exponent of 3 is MINOR_EXPONENT_UNSUPPORTED), and
    // formatMoney caps decimals at the exponent, so a third value would need both to change.
    for (const code of SUPPORTED_COUNTRY_CODES) {
      expect([0, 2]).toContain(MARKETS[code].currencyMinorExponent);
    }
    expect(SUPPORTED_COUNTRY_CODES.filter((c) => MARKETS[c].currencyMinorExponent === 0)).toEqual(['UG', 'RW']);
  });

  it('opens signup only in Kenya and Ghana, and keeps the hidden markets crop-only', () => {
    for (const code of SUPPORTED_COUNTRY_CODES) {
      const open = code === 'KE' || code === 'GH';
      expect(MARKETS[code].signupOpen).toBe(open);
      if (!open) expect(MARKETS[code].livestockEnabled).toBe(false);
    }
  });

  it('gives every market a phone regex that matches its own example', () => {
    for (const code of SUPPORTED_COUNTRY_CODES) {
      const market = MARKETS[code];
      expect(market.phoneRegex.test(market.phoneExample)).toBe(true);
      // And the local form normalises into something the regex accepts, which is what makes the
      // placeholder pair usable.
      expect(isValidPhoneForMarket(market.phoneLocalExample, market)).toBe(true);
    }
  });

  it('gives no market another market’s phone example', () => {
    expect(new Set(SUPPORTED_COUNTRY_CODES.map((c) => MARKETS[c].phoneExample)).size).toBe(
      SUPPORTED_COUNTRY_CODES.length,
    );
  });
});
