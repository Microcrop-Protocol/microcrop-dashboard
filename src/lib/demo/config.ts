/**
 * Engine constants — cadence/jitter, index bounds, fee rate, and crop
 * sum-insured bands per market. Tuned so the demo "breathes" like a live market
 * without ever drifting to absurd values.
 */

import type { Crop, MarketCode } from './types';

// ---------------------------------------------------------------------------
// Cadence & jitter (ms unless noted). Each channel self-reschedules with jitter.
// ---------------------------------------------------------------------------

export const CADENCE = {
  /** Index tick base interval; ±40% per chip, staggered. */
  indexTick: 2000,
  indexTickJitter: 0.4,

  /** KPI bump base interval; ±50%. */
  kpiBump: 2500,
  kpiBumpJitter: 0.5,

  /** Activity event base interval; ±50%. */
  activity: 3500,
  activityJitter: 0.5,

  /** Payout event base interval; ±40%, weighted up when regional stress high. */
  payout: 35000,
  payoutJitter: 0.4,
} as const;

// ---------------------------------------------------------------------------
// Index walk bounds (mean-reverting random walk).
// ---------------------------------------------------------------------------

export const INDEX = {
  ndvi: { min: 0.15, max: 0.85, step: 0.02, mean: 0.55, reversion: 0.05 },
  rainfall: { min: 0, max: 120, step: 4, mean: 55, reversion: 0.05 },
} as const;

/** Stress = how close the index sits to its "dry/dangerous" end (0..1). */
export const STRESS_PAYOUT_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// KPI / money model.
// ---------------------------------------------------------------------------

export const FEE_RATE = 0.08; // fees = premiums * feeRate

/** Rolling sparkline window length. */
export const SPARK_WINDOW = 24;

/** Fallback baselines if no seed is supplied (KES-scale numbers). */
export const DEFAULT_SEED = {
  farmers: 1240,
  activePolicies: 860,
  premiums: 4_800_000,
  payouts: 1_150_000,
  fees: 384_000,
} as const;

// ---------------------------------------------------------------------------
// Activity mix + market split.
// ---------------------------------------------------------------------------

export const EVENT_MIX = {
  policy: 0.6,
  determination: 0.25,
  payout: 0.15,
} as const;

/** Roughly 60/40 KE/GH so both markets stream continuously. */
export const MARKET_WEIGHTS: Record<MarketCode, number> = {
  KE: 0.6,
  GH: 0.4,
};

// ---------------------------------------------------------------------------
// Sum-insured bands per crop per market (in the market's currency units).
// Premium ≈ 6–12% of sum insured; payout ≈ 40–90% of sum insured.
// ---------------------------------------------------------------------------

export interface Band {
  min: number;
  max: number;
}

/** [KES, GHS] scaled bands. GHS values are ~1/12 of KES to feel local. */
export const SUM_INSURED_BANDS: Record<MarketCode, Record<Crop, Band>> = {
  KE: {
    maize: { min: 8000, max: 24000 },
    sorghum: { min: 6000, max: 18000 },
    beans: { min: 7000, max: 20000 },
    millet: { min: 5000, max: 15000 },
    rice: { min: 12000, max: 30000 },
    cowpea: { min: 5000, max: 14000 },
  },
  GH: {
    maize: { min: 700, max: 2200 },
    sorghum: { min: 500, max: 1600 },
    beans: { min: 600, max: 1800 },
    millet: { min: 450, max: 1300 },
    rice: { min: 1000, max: 2600 },
    cowpea: { min: 450, max: 1200 },
  },
};

export const PREMIUM_RATE = { min: 0.06, max: 0.12 } as const;
export const PAYOUT_FRACTION = { min: 0.4, max: 0.9 } as const;

/** Caps for in-memory rolling buffers. */
export const BUFFERS = {
  activityMax: 50,
  payoutHistoryMax: 25,
} as const;
