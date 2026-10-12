/**
 * The plot, herd and policy schemas are functions of the organization's market and catalogue.
 *
 * Pinned: a plot's crop is accepted when the market LISTS it, in any status — the backend's plot
 * gate — while a herd's species must be SELLABLE (the livestock wizard registers the herd to
 * insure it). Nothing is accepted while the catalogue is unknown, and the sum-insured messages
 * name the market's own bounds and currency — never "USDC", and never Kenya's ceiling in Ghana.
 */
import { describe, expect, it } from 'vitest';
import { plotCreationSchemaFor, policyConfigSchemaFor } from '@/lib/validations/onboarding';
import { herdRegistrationSchemaFor } from '@/lib/validations/livestock-onboarding';
import { MARKETS } from '@/lib/market';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';

const PLOT = { name: 'North Field', latitude: -0.3, longitude: 36.08, acreage: 2.5, plantingDate: '' };
const HERD = { name: 'Main herd', headCount: 10, estimatedValue: 15000, insuranceUnitId: 'u1' };

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe('plotCreationSchemaFor', () => {
  const ke = plotCreationSchemaFor(KE_CATALOGUE.lines.CROP);
  const gh = plotCreationSchemaFor(GH_CATALOGUE.lines.CROP);

  it('accepts AVAILABLE and PILOT crops of the market', () => {
    expect(ke.safeParse({ ...PLOT, cropType: 'MAIZE' }).success).toBe(true);
    expect(ke.safeParse({ ...PLOT, cropType: 'GREEN_GRAMS' }).success).toBe(true);
    expect(gh.safeParse({ ...PLOT, cropType: 'SOYBEAN' }).success).toBe(true);
  });

  it('accepts a coming-soon crop — the backend registers a plot for any LISTED crop', () => {
    expect(ke.safeParse({ ...PLOT, cropType: 'WHEAT' }).success).toBe(true);
    expect(gh.safeParse({ ...PLOT, cropType: 'COWPEA' }).success).toBe(true);
  });

  it('accepts a listed crop the server has not priced', () => {
    const unpriced = KE_CATALOGUE.lines.CROP.map((c) =>
      c.code === 'MAIZE' ? { ...c, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : c,
    );
    expect(plotCreationSchemaFor(unpriced).safeParse({ ...PLOT, cropType: 'MAIZE' }).success).toBe(true);
  });

  it("refuses another market's crop and a crop no market lists", () => {
    expect(gh.safeParse({ ...PLOT, cropType: 'GREEN_GRAMS' }).success).toBe(false);
    expect(ke.safeParse({ ...PLOT, cropType: 'TEA' }).success).toBe(false);
  });

  it('accepts nothing while the catalogue is unknown, and says why', () => {
    const unknown = plotCreationSchemaFor(null);
    expect(firstMessage(unknown.safeParse({ ...PLOT, cropType: 'MAIZE' }))).toMatch(/hasn't loaded yet/);
  });
});

describe('herdRegistrationSchemaFor', () => {
  it("accepts the market's livestock and refuses poultry, which no market lists", () => {
    const ke = herdRegistrationSchemaFor(KE_CATALOGUE.lines.LIVESTOCK);
    expect(ke.safeParse({ ...HERD, livestockType: 'CAMEL' }).success).toBe(true);
    expect(ke.safeParse({ ...HERD, livestockType: 'POULTRY' }).success).toBe(false);
  });

  it('refuses a listed species the server says is not sellable — the herd is registered to be insured', () => {
    const livestock = KE_CATALOGUE.lines.LIVESTOCK.map((item) =>
      item.code === 'CAMEL' ? { ...item, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : item,
    );
    const ke = herdRegistrationSchemaFor(livestock);
    expect(firstMessage(ke.safeParse({ ...HERD, livestockType: 'CAMEL' }))).toMatch(
      /offered in your organization's market/,
    );
    expect(ke.safeParse({ ...HERD, livestockType: 'CATTLE' }).success).toBe(true);
  });

  it('refuses a coming-soon species', () => {
    const livestock = KE_CATALOGUE.lines.LIVESTOCK.map((item) =>
      item.code === 'GOAT' ? { ...item, status: 'COMING_SOON' as const, sellable: false } : item,
    );
    expect(herdRegistrationSchemaFor(livestock).safeParse({ ...HERD, livestockType: 'GOAT' }).success).toBe(false);
  });

  it('accepts no species in a market whose livestock line is empty (Ghana)', () => {
    const gh = herdRegistrationSchemaFor(GH_CATALOGUE.lines.LIVESTOCK);
    expect(gh.safeParse({ ...HERD, livestockType: 'CATTLE' }).success).toBe(false);
  });

  it('requires a choice — there is no pre-selected default species', () => {
    const ke = herdRegistrationSchemaFor(KE_CATALOGUE.lines.LIVESTOCK);
    expect(firstMessage(ke.safeParse({ ...HERD, livestockType: '' }))).toBe('Select a livestock type');
  });
});

describe('policyConfigSchemaFor', () => {
  const CONFIG = { coverageType: 'DROUGHT' as const, durationDays: 90 };

  it("uses Ghana's ceiling and currency in Ghana", () => {
    const gh = policyConfigSchemaFor(MARKETS.GH);
    expect(gh.safeParse({ ...CONFIG, sumInsured: 250000 }).success).toBe(true);
    expect(firstMessage(gh.safeParse({ ...CONFIG, sumInsured: 300000 }))).toBe(
      'Maximum sum insured is GHS 250,000',
    );
  });

  it("uses Kenya's bounds and currency in Kenya", () => {
    const ke = policyConfigSchemaFor(MARKETS.KE);
    expect(ke.safeParse({ ...CONFIG, sumInsured: 300000 }).success).toBe(true);
    expect(firstMessage(ke.safeParse({ ...CONFIG, sumInsured: 500 }))).toBe('Minimum sum insured is KES 1,000');
  });

  it('names no currency — and never USDC — with no market in hand', () => {
    const any = policyConfigSchemaFor(null);
    const message = firstMessage(any.safeParse({ ...CONFIG, sumInsured: 500 }));
    expect(message).toBe('Minimum sum insured is 1,000');
    expect(message).not.toMatch(/USDC|KES|GHS/);
  });
});
