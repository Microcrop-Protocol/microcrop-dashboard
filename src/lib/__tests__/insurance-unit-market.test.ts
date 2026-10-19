/**
 * INSURANCE UNITS PER MARKET.
 *
 *   1. NO UNIT WHERE NO LIVESTOCK IS SOLD. Ghana's livestock is hidden, and a unit carries only
 *      livestock terms, so a Ghana unit is not offered at all.
 *   2. KENYAN DEFAULTS STAY IN KENYA. The pre-filled 1,500 / 15,000 are KES; carrying them into
 *      another market prices a herd with a number nobody typed. A typed figure is kept.
 *   3. A RESET KEEPS THE MARKET. The old `form.reset()` snapped back to Kenya after every create.
 *   4. GHANA CODES CARRY GH-. The hint and the message say so in words an operator can act on.
 */
import { describe, it, expect } from 'vitest';
import {
  CROP_SEASONS,
  LIVESTOCK_SEASONS,
  blankUnitForm,
  livestockUnitsOffered,
  seasonHeading,
  seasonShortLabel,
  swapUnitDefaults,
  unitCodeHint,
  unitCodePlaceholder,
  unitCodePrefixError,
  unitDefaultsFor,
} from '@/lib/insurance-unit-market';

describe('which markets can have a unit', () => {
  it('offers units in Kenya and not in Ghana', () => {
    expect(livestockUnitsOffered('KE')).toBe(true);
    expect(livestockUnitsOffered('GH')).toBe(false);
  });

  it('offers none for an unknown or missing market', () => {
    expect(livestockUnitsOffered('ZZ')).toBe(false);
    expect(livestockUnitsOffered(null)).toBe(false);
  });

  it('offers none in the hidden markets, none of which lists livestock', () => {
    for (const code of ['UG', 'TZ', 'ZM', 'NG', 'RW']) expect(livestockUnitsOffered(code)).toBe(false);
  });
});

describe('seasons per market', () => {
  it("names Kenya's livestock seasons with their months", () => {
    expect(LIVESTOCK_SEASONS.KE?.map((s) => s.code)).toEqual(['LRLD', 'SRSD']);
    expect(seasonHeading('KE', 'LRLD')).toBe('LRLD — Long rains / long dry (Mar–Sep)');
    expect(seasonHeading('KE', 'SRSD')).toBe('SRSD — Short rains / short dry (Oct–Feb)');
    expect(seasonShortLabel('KE', 'SRSD')).toBe('SRSD (Oct–Feb)');
  });

  it('has no livestock seasons for Ghana, and falls back to the bare code', () => {
    expect(LIVESTOCK_SEASONS.GH).toBeUndefined();
    expect(seasonHeading('GH', 'LRLD')).toBe('LRLD');
    expect(seasonShortLabel(null, 'LRLD')).toBe('LRLD');
  });

  it("lists Ghana's crop seasons by zone", () => {
    expect(CROP_SEASONS.GH?.map((s) => s.code)).toEqual(['MAIN', 'MAJOR', 'MINOR']);
  });

  it("lists each hidden market's crop seasons with exactly the backend seasonCodes", () => {
    expect(CROP_SEASONS.UG?.map((s) => s.code)).toEqual(['FIRST', 'SECOND', 'NORTH']);
    expect(CROP_SEASONS.TZ?.map((s) => s.code)).toEqual(['MSIMU', 'MASIKA', 'VULI']);
    expect(CROP_SEASONS.ZM?.map((s) => s.code)).toEqual(['MAIN']);
    expect(CROP_SEASONS.NG?.map((s) => s.code)).toEqual(['MAJOR_SOUTH', 'MINOR_SOUTH', 'MAJOR_NORTH']);
    expect(CROP_SEASONS.RW?.map((s) => s.code)).toEqual(['SEASON_A', 'SEASON_B']);
  });

  it('has no livestock seasons and no unit defaults in a hidden market', () => {
    for (const code of ['UG', 'TZ', 'ZM', 'NG', 'RW'] as const) {
      expect(LIVESTOCK_SEASONS[code]).toBeUndefined();
      expect(Object.values(unitDefaultsFor(code)).every((v) => v === undefined)).toBe(true);
    }
  });
});

describe('unit codes', () => {
  it('requires GH- on a Ghana code, case-insensitively, with a usable message', () => {
    expect(unitCodePrefixError('GH', 'GH-NP-01')).toBeNull();
    expect(unitCodePrefixError('GH', 'gh-np-01')).toBeNull();
    expect(unitCodePrefixError('GH', 'NORTHERN')).toMatch(/Ghana unit codes must start with GH-/);
  });

  it('does not enforce a prefix on Kenya, whose legacy codes predate it', () => {
    expect(unitCodePrefixError('KE', 'TURKANA')).toBeNull();
  });

  it('requires its own prefix in every other market, as the backend requiredUnitCodePrefix does', () => {
    for (const code of ['UG', 'TZ', 'ZM', 'NG', 'RW'] as const) {
      expect(unitCodePrefixError(code, `${code}-NORTH-01`)).toBeNull();
      expect(unitCodePrefixError(code, 'GH-NORTH-01')).toMatch(new RegExp(`unit codes must start with ${code}-`));
    }
    expect(unitCodeHint('UG')).toBe('Uganda unit codes must start with UG-');
    expect(unitCodePrefixError('NG', 'KADUNA')).toBe('Nigeria unit codes must start with NG- (for example NG-NP-01).');
  });

  it('hints and placeholds per market, with no Kenyan place in it', () => {
    expect(unitCodeHint('GH')).toBe('Ghana unit codes must start with GH-');
    expect(unitCodeHint('KE')).toMatch(/KE- followed by the county code/);
    expect(unitCodePlaceholder('GH')).toBe('GH-…');
    expect(`${unitCodeHint('KE')} ${unitCodePlaceholder('KE')}`).not.toMatch(/turkana/i);
  });
});

describe('market defaults', () => {
  it('pre-fills Kenya only', () => {
    expect(unitDefaultsFor('KE')).toMatchObject({ premiumRateLRLD: 1500, valuePerTLU: 15000 });
    expect(Object.values(unitDefaultsFor('GH')).every((v) => v === undefined)).toBe(true);
  });

  it('clears every untouched Kenyan default when switching to Ghana', () => {
    const changes = swapUnitDefaults(unitDefaultsFor('KE'), 'KE', 'GH');
    expect(changes).toEqual({
      ndviBaselineLRLD: undefined,
      ndviBaselineSRSD: undefined,
      strikeLevelLRLD: undefined,
      strikeLevelSRSD: undefined,
      premiumRateLRLD: undefined,
      premiumRateSRSD: undefined,
      valuePerTLU: undefined,
    });
  });

  it('keeps a figure the operator typed', () => {
    const changes = swapUnitDefaults({ ...unitDefaultsFor('KE'), valuePerTLU: 900 }, 'KE', 'GH');
    expect(changes).not.toHaveProperty('valuePerTLU');
    expect(changes.premiumRateLRLD).toBeUndefined();
  });

  it('restores the defaults on the way back to Kenya', () => {
    const changes = swapUnitDefaults(unitDefaultsFor('GH'), 'GH', 'KE');
    expect(changes).toEqual(unitDefaultsFor('KE'));
  });

  it('changes nothing when switching to the same market', () => {
    expect(swapUnitDefaults(unitDefaultsFor('KE'), 'KE', 'KE')).toEqual({});
  });
});

describe('blankUnitForm', () => {
  it('keeps the market it is given rather than snapping back to the default', () => {
    expect(blankUnitForm('GH').country).toBe('GH');
    expect(blankUnitForm('GH').valuePerTLU).toBeUndefined();
    expect(blankUnitForm('KE')).toMatchObject({ country: 'KE', unitCode: '', valuePerTLU: 15000 });
  });
});
