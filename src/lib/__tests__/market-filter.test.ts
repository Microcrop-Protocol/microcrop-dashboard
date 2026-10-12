/**
 * MARKET FILTER for platform screens.
 *
 *   1. MONEY SCREENS CANNOT BE SET TO "ALL MARKETS" — adding KES to GHS has no unit. An `ALL`
 *      in the URL of a single-market screen lands on that screen's default, not on a mix.
 *   2. THE SINGLE-MARKET DEFAULT IS THE FIRST REGISTRY MARKET, read from the registry rather
 *      than written as 'KE', and it is a visible selection (see MarketSelect).
 *   3. LABELS SPANNING MARKETS NAME EVERY MARKET'S DIVISION — "County" alone is wrong for Ghana.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_MARKETS,
  countryCodeParam,
  defaultMarketFilter,
  divisionLabelForFilter,
  marketFilterOptions,
  marketForFilter,
  parseMarketFilter,
  pluralDivisionLabel,
} from '@/lib/market-filter';
import { MARKETS, SUPPORTED_COUNTRY_CODES } from '@/lib/market';

describe('defaults', () => {
  it('defaults a money screen to the first registry market', () => {
    expect(defaultMarketFilter('single')).toBe(SUPPORTED_COUNTRY_CODES[0]);
  });

  it('defaults a count screen to all markets', () => {
    expect(defaultMarketFilter('any')).toBe(ALL_MARKETS);
  });
});

describe('parseMarketFilter', () => {
  it('accepts a supported market in any case', () => {
    expect(parseMarketFilter('gh', 'single')).toBe('GH');
    expect(parseMarketFilter(' KE ', 'any')).toBe('KE');
  });

  it('accepts ALL only where all markets are meaningful', () => {
    expect(parseMarketFilter('ALL', 'any')).toBe(ALL_MARKETS);
    expect(parseMarketFilter('all', 'single')).toBe(SUPPORTED_COUNTRY_CODES[0]);
  });

  it('lands an unknown value on the default rather than guessing', () => {
    expect(parseMarketFilter('UG', 'any')).toBe(ALL_MARKETS);
    expect(parseMarketFilter('UG', 'single')).toBe(SUPPORTED_COUNTRY_CODES[0]);
    expect(parseMarketFilter(null, 'single')).toBe(SUPPORTED_COUNTRY_CODES[0]);
  });
});

describe('marketFilterOptions', () => {
  it('offers "All markets" first on a count screen', () => {
    const options = marketFilterOptions('any');
    expect(options[0]).toEqual({ value: ALL_MARKETS, label: 'All markets' });
    expect(options.map((o) => o.value)).toEqual([ALL_MARKETS, ...SUPPORTED_COUNTRY_CODES]);
  });

  it('does not offer "All markets" on a money screen', () => {
    const options = marketFilterOptions('single');
    expect(options.map((o) => o.value)).toEqual([...SUPPORTED_COUNTRY_CODES]);
  });

  it('labels each market with its currency', () => {
    expect(marketFilterOptions('single').find((o) => o.value === 'GH')?.label).toBe('Ghana (GHS)');
  });
});

describe('what a filter sends and means', () => {
  it('sends no countryCode for all markets', () => {
    expect(countryCodeParam(ALL_MARKETS)).toBeUndefined();
    expect(countryCodeParam('GH')).toBe('GH');
  });

  it('has no market for all markets', () => {
    expect(marketForFilter(ALL_MARKETS)).toBeNull();
    expect(marketForFilter('GH')).toBe(MARKETS.GH);
  });
});

describe('division labels', () => {
  it("uses the market's own label for one market", () => {
    expect(divisionLabelForFilter('KE')).toBe('County');
    expect(divisionLabelForFilter('GH')).toBe('Region');
  });

  it('names every market\'s label across markets', () => {
    expect(divisionLabelForFilter(ALL_MARKETS)).toBe('County / Region');
  });

  it('pluralises the labels the registry carries', () => {
    expect(pluralDivisionLabel('County')).toBe('Counties');
    expect(pluralDivisionLabel('Region')).toBe('Regions');
    expect(pluralDivisionLabel('County / Region')).toBe('Counties / Regions');
  });
});
