/**
 * SAMPLE VALUES for placeholders and import templates, per market.
 *
 * These were literals scattered across the onboarding wizards and the import page — "Mwangi",
 * "Kinoo", "Turkana", a Nairobi latitude — so a Ghanaian field agent was shown Kenyan examples on
 * every form, and the import template fell back to Nakuru whenever the market had not resolved.
 *
 * PRESENTATION ONLY. Nothing here is validated against or sent anywhere: a placeholder is a hint
 * about the SHAPE of an answer. Kept out of lib/market.ts, whose registry is pinned by a test as
 * the mirror of the backend's markets.js; examples are not part of that contract.
 *
 * `null` market → `null` samples. A caller renders an empty placeholder rather than another
 * country's example: an example from the wrong country is an instruction to type the wrong thing.
 */
import type { CountryCode, Market } from '@/lib/market';

export interface MarketSamples {
  lastName: string;
  /** A level-1 division (KE county / GH region / the market's `adminDivisionLabels.level1`). */
  level1: string;
  /** A level-2 division inside `level1` (KE sub-county / GH district). */
  level2: string;
  /** Ward and village are optional fields; empty where the example would not be meaningful. */
  ward: string;
  village: string;
  /** A pastoral level-1/level-2 pair, for the livestock wizard. Empty where livestock is not offered. */
  pastoralLevel1: string;
  pastoralLevel2: string;
  /** A point inside the market, for a plot location example. Decimal-degree strings. */
  latitude: string;
  longitude: string;
  /**
   * A planting date inside the market's main crop season (KE long rains, March–May; GH major
   * season, April–July; the hidden markets per the comment on each), ISO `YYYY-MM-DD`, for the
   * plot import template.
   */
  plantingDate: string;
}

const SAMPLES: Readonly<Record<CountryCode, MarketSamples>> = Object.freeze({
  KE: {
    lastName: 'Mwangi',
    level1: 'Nakuru',
    level2: 'Nakuru East',
    ward: 'Kinoo',
    village: 'Kinoo Village',
    pastoralLevel1: 'Turkana',
    pastoralLevel2: 'Turkana Central',
    latitude: '-0.3031',
    longitude: '36.08',
    plantingDate: '2026-03-15',
  },
  GH: {
    lastName: 'Mensah',
    level1: 'Ashanti',
    level2: 'Kumasi Metropolitan',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '6.6885',
    longitude: '-1.6244',
    plantingDate: '2026-04-15',
  },
  // The hidden markets. Coordinates are approximate town points; ward, village and the pastoral
  // pair are empty because none of these markets offers livestock. Each planting date sits in
  // the backend's INDICATIVE season window for the zone the sample place is in.
  UG: {
    lastName: 'Okello',
    level1: 'Masindi',
    // Sub-county of Masindi district; not checked against the current UBOS list.
    level2: 'Pakanyi',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '1.6744',
    longitude: '31.715',
    // FIRST season (MAM rains), planted Mar-Apr.
    plantingDate: '2026-03-20',
  },
  TZ: {
    lastName: 'Mushi',
    level1: 'Iringa',
    level2: 'Kilolo',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '-7.77',
    longitude: '35.69',
    // Iringa is unimodal: MSIMU, planted Nov-Dec.
    plantingDate: '2025-12-01',
  },
  ZM: {
    lastName: 'Phiri',
    level1: 'Eastern',
    level2: 'Chipata',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '-13.64',
    longitude: '32.65',
    // MAIN rainy season, planted Nov-Dec.
    plantingDate: '2025-11-20',
  },
  NG: {
    lastName: 'Ibrahim',
    level1: 'Kaduna',
    level2: 'Zaria',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '11.085',
    longitude: '7.719',
    // Kaduna is in the north: MAJOR_NORTH, planted May-Jul.
    plantingDate: '2026-06-01',
  },
  RW: {
    lastName: 'Mugisha',
    level1: 'Eastern',
    level2: 'Nyagatare',
    ward: '',
    village: '',
    pastoralLevel1: '',
    pastoralLevel2: '',
    latitude: '-1.3',
    longitude: '30.33',
    // SEASON_B (long rains), planted in March.
    plantingDate: '2026-03-10',
  },
});

export function marketSamples(market: Market | null | undefined): MarketSamples | null {
  return market ? SAMPLES[market.countryCode] ?? null : null;
}
