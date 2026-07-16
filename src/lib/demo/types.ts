/**
 * MicroCrop Demo — Simulation engine data contract.
 *
 * PURELY CLIENT-SIDE. These types describe the in-memory streams produced by the
 * demo `SimulationEngine`. Nothing here touches the network, auth, or money-logic.
 * Every money value carries an explicit `currency` (from `@/lib/market` MARKETS)
 * so the UI formats it through `formatCurrency(...)` and never hardcodes a symbol.
 *
 * See `src/lib/demo/README` intent: a live "market of climate risk" layered on
 * seeded demo data, gated by `VITE_DEMO_MODE === 'true'`.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Keys of `MARKETS` in `@/lib/market`. */
export type MarketCode = 'KE' | 'GH';

/** Tick direction for a re-priced index or metric. */
export type Direction = 'up' | 'down' | 'flat';

/** The two climate indices the ticker walks. */
export type IndexKind = 'NDVI' | 'RAINFALL';

/** Crops streamed by the demo (must exist across KE + GH regions). */
export type Crop = 'maize' | 'sorghum' | 'beans' | 'millet' | 'rice' | 'cowpea';

/** Insurable perils. */
export type Peril = 'drought' | 'flood';

/** A region within a market (KE county / GH region). */
export interface Region {
  /** Stable id, e.g. 'KE-NKR'. */
  id: string;
  /** Owning market. */
  market: MarketCode;
  /** Human name, e.g. 'Nakuru'. */
  name: string;
  /** Crops grown in the region (used to pick realistic event crops). */
  crops: Crop[];
  /** Which climate index dominates the region's risk story. */
  primaryIndex: IndexKind;
}

// ---------------------------------------------------------------------------
// (a) Index ticker
// ---------------------------------------------------------------------------

export interface IndexTick {
  regionId: string;
  /** Human region name, e.g. 'Nakuru'. */
  region: string;
  /** Owning market — used for the flag glyph / label, NOT for currency. */
  market: MarketCode;
  kind: IndexKind;
  /** NDVI 0..1 (2dp) | rainfall mm (int). */
  value: number;
  /** '' for NDVI | 'mm' for rainfall. */
  unit: string;
  /** Signed percent change from the previous value, e.g. -1.1. */
  deltaPct: number;
  dir: Direction;
  /** 0..1 derived risk (1 = high payout likelihood). */
  stress: number;
  /** Epoch ms of this tick. */
  ts: number;
}

// ---------------------------------------------------------------------------
// (b) Live KPIs
// ---------------------------------------------------------------------------

export type KpiKey =
  | 'farmers'
  | 'activePolicies'
  | 'lossRatio'
  | 'premiums'
  | 'payouts'
  | 'fees';

export interface KpiMetric {
  key: KpiKey;
  /** Raw number; formatting done by the card via `@/lib/market`. */
  value: number;
  /** Present for money metrics -> formatCurrency(value, currency). */
  currency?: string;
  isCurrency: boolean;
  /** lossRatio is rendered as a percent. */
  isPercent: boolean;
  /** Signed change from the most recent bump (0 if none pending). */
  lastDelta: number;
  /** Unique id per bump so the UI can trigger a one-shot flash. */
  deltaId: string | null;
  /** Rolling window (<=24) of recent values for the sparkline. */
  spark: number[];
  ts: number;
}

export interface LiveKpis {
  metrics: Record<KpiKey, KpiMetric>;
  /** Active org market — money metrics use this currency. */
  market: MarketCode;
}

// ---------------------------------------------------------------------------
// (c) Activity stream
// ---------------------------------------------------------------------------

export type DemoEventType = 'policy' | 'determination' | 'payout';

export interface DemoEvent {
  id: string;
  type: DemoEventType;
  market: MarketCode;
  /** Human region name, e.g. 'Turkana'. */
  region: string;
  regionId: string;
  crop: Crop;
  /** For determination/payout. */
  peril?: Peril;
  /** sum insured (policy) | shortfall/payout (others); 0 if n/a. */
  amount: number;
  /** 'KES' | 'GHS' -> formatCurrency(amount, currency). */
  currency: string;
  /** Masked farmer name, e.g. 'J•••a M.'. */
  farmerMasked: string;
  /** Short ref, e.g. 'a1b2' (payout/determination). */
  determinationRef?: string;
  ts: number;
}

// ---------------------------------------------------------------------------
// (d) Payout events (a filtered, richer channel of the same bus)
// ---------------------------------------------------------------------------

export interface PayoutEvent extends DemoEvent {
  type: 'payout';
  peril: Peril;
  /** Usually 1–3. */
  farmersPaid: number;
}

// ---------------------------------------------------------------------------
// Engine control
// ---------------------------------------------------------------------------

/** Optional baseline sourced once from seeded API data. */
export interface DemoSeed {
  premiums?: number;
  payouts?: number;
  fees?: number;
  activePolicies?: number;
  farmers?: number;
  market?: MarketCode;
  /** Optional deterministic seed for repeatable demos. */
  rngSeed?: number;
}

/**
 * The one engine singleton. Owns timers + an event bus and exposes a
 * `useSyncExternalStore`-friendly snapshot per channel via `hooks.ts`.
 */
export interface SimulationEngine {
  /** Idempotent: starts timers (once) and applies the optional seed baseline. */
  start(seed?: DemoSeed): void;
  /** Clears all timers + listeners. Safe to call when not running. */
  stop(): void;
  isRunning(): boolean;

  // ---- subscription surface (used by hooks via useSyncExternalStore) ----
  subscribeTicker(cb: () => void): () => void;
  getTicker(): IndexTick[];

  subscribeKpis(cb: () => void): () => void;
  getKpis(): LiveKpis;

  subscribeActivity(cb: () => void): () => void;
  getActivity(): DemoEvent[];

  subscribePayouts(cb: () => void): () => void;
  getPayouts(): { latest: PayoutEvent | null; history: PayoutEvent[] };
}
