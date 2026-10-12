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
  /** A level-1 division (KE county / GH region). */
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
  },
});

export function marketSamples(market: Market | null | undefined): MarketSamples | null {
  return market ? SAMPLES[market.countryCode] ?? null : null;
}
