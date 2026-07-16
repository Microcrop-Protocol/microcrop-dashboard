/**
 * SimulationEngine — the single client-side singleton that powers the demo's
 * "market of climate risk". It owns all timers and four independent snapshot
 * channels (ticker / KPIs / activity / payouts), each exposed to React via
 * `useSyncExternalStore` from `hooks.ts`.
 *
 * SAFETY: purely in-memory. No network, no auth, no wallet, no mutations. It
 * only *reads* an optional seed baseline once at `start()`. When demo mode is
 * off this module is never imported (it's dynamically loaded by
 * `DemoModeProvider` only when `VITE_DEMO_MODE === 'true'`), so it's
 * tree-shaken out of the production bundle.
 *
 * Design notes:
 *  - Timers are self-rescheduling `setTimeout` calls (not `setInterval`) so each
 *    channel can apply per-tick jitter and stagger.
 *  - Each channel keeps an immutable snapshot; `getX()` returns a stable
 *    reference until that channel actually changes (required by
 *    `useSyncExternalStore`).
 *  - The engine pauses on `document.hidden` (visibilitychange) and resumes
 *    cleanly, to save CPU when the tab is backgrounded.
 */

import {
  BUFFERS,
  CADENCE,
  DEFAULT_SEED,
  EVENT_MIX,
  FEE_RATE,
  INDEX,
  MARKET_WEIGHTS,
  PAYOUT_FRACTION,
  PREMIUM_RATE,
  SPARK_WINDOW,
  STRESS_PAYOUT_THRESHOLD,
  SUM_INSURED_BANDS,
} from './config';
import { clamp, createRng, type Rng } from './rng';
import {
  FARMER_FIRST_NAMES,
  FARMER_LAST_INITIALS,
  REGIONS,
} from './regions';
import type {
  Crop,
  DemoEvent,
  DemoEventType,
  DemoSeed,
  Direction,
  IndexTick,
  KpiKey,
  KpiMetric,
  LiveKpis,
  MarketCode,
  PayoutEvent,
  Peril,
  Region,
  SimulationEngine,
} from './types';
import { MARKETS } from '@/lib/market';

// ---------------------------------------------------------------------------
// Internal channel state
// ---------------------------------------------------------------------------

interface IndexState {
  region: Region;
  kind: 'NDVI' | 'RAINFALL';
  value: number;
  prev: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const MONEY_KEYS: KpiKey[] = ['premiums', 'payouts', 'fees'];

function direction(delta: number): Direction {
  if (Math.abs(delta) < 1e-6) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/** id helper — short, unique-enough for demo UI keys. */
function uid(rng: Rng): string {
  return (
    Date.now().toString(36) +
    Math.floor(rng.next() * 0xfffff).toString(36)
  );
}

function shortRef(rng: Rng): string {
  return Math.floor(rng.next() * 0xffff)
    .toString(16)
    .padStart(4, '0');
}

/** Mask a first name: 'Joanna' -> 'J•••a'. */
function maskName(first: string, initial: string): string {
  const head = first.slice(0, 1);
  const tail = first.length > 2 ? first.slice(-1) : '';
  return `${head}•••${tail} ${initial}`.trim();
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

class Engine implements SimulationEngine {
  private running = false;
  private paused = false;
  private rng: Rng = createRng(1);

  // seed / active market for KPI money metrics
  private market: MarketCode = 'KE';

  // ---- ticker channel ----
  private indices: IndexState[] = [];
  private tickerSnapshot: IndexTick[] = [];
  private tickerListeners = new Set<() => void>();

  // ---- KPI channel ----
  private kpiRaw: Record<KpiKey, number> = {
    farmers: DEFAULT_SEED.farmers,
    activePolicies: DEFAULT_SEED.activePolicies,
    lossRatio: 0,
    premiums: DEFAULT_SEED.premiums,
    payouts: DEFAULT_SEED.payouts,
    fees: DEFAULT_SEED.fees,
  };
  private kpiSpark: Record<KpiKey, number[]> = {
    farmers: [],
    activePolicies: [],
    lossRatio: [],
    premiums: [],
    payouts: [],
    fees: [],
  };
  private kpiPendingDelta: Record<KpiKey, { delta: number; id: string } | null> = {
    farmers: null,
    activePolicies: null,
    lossRatio: null,
    premiums: null,
    payouts: null,
    fees: null,
  };
  private kpiSnapshot: LiveKpis = this.buildKpiSnapshot();
  private kpiListeners = new Set<() => void>();
  private kpiTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- activity channel ----
  private activity: DemoEvent[] = [];
  private activitySnapshot: DemoEvent[] = [];
  private activityListeners = new Set<() => void>();
  private activityTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- payout channel ----
  private payoutHistory: PayoutEvent[] = [];
  private payoutSnapshot: { latest: PayoutEvent | null; history: PayoutEvent[] } = {
    latest: null,
    history: [],
  };
  private payoutListeners = new Set<() => void>();
  private payoutTimer: ReturnType<typeof setTimeout> | null = null;

  private visibilityHandler: (() => void) | null = null;

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

  start(seed?: DemoSeed): void {
    if (this.running) {
      // Idempotent, but allow refreshing the seed baseline on first real data.
      if (seed) this.applySeed(seed);
      return;
    }
    this.running = true;
    this.paused = false;

    const rngSeed = seed?.rngSeed ?? (Date.now() & 0x7fffffff) ^ 0x9e3779b9;
    this.rng = createRng(rngSeed >>> 0);

    this.applySeed(seed);
    this.initIndices();
    this.recomputeLossRatio();
    this.kpiSnapshot = this.buildKpiSnapshot();

    // Pause when the tab is hidden; resume when visible.
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.hidden) this.pause();
        else this.resume();
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    this.scheduleAll();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.clearTimers();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.visibilityHandler = null;
    // Note: listeners are intentionally kept — components may remount and the
    // React store contract requires subscribe/unsubscribe symmetry. They are
    // cleared naturally as components unsubscribe.
  }

  isRunning(): boolean {
    return this.running;
  }

  private pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.clearTimers();
  }

  private resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.scheduleAll();
  }

  private clearTimers(): void {
    for (const idx of this.indices) {
      if (idx.timer) clearTimeout(idx.timer);
      idx.timer = null;
    }
    if (this.kpiTimer) clearTimeout(this.kpiTimer);
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.payoutTimer) clearTimeout(this.payoutTimer);
    this.kpiTimer = this.activityTimer = this.payoutTimer = null;
  }

  private scheduleAll(): void {
    // Stagger index chips so they re-price out of sync.
    this.indices.forEach((idx, i) => {
      const start = this.rng.jitter(CADENCE.indexTick, CADENCE.indexTickJitter) + i * 120;
      idx.timer = setTimeout(() => this.tickIndex(idx), start);
    });
    this.kpiTimer = setTimeout(
      () => this.tickKpi(),
      this.rng.jitter(CADENCE.kpiBump, CADENCE.kpiBumpJitter),
    );
    this.activityTimer = setTimeout(
      () => this.tickActivity(),
      this.rng.jitter(CADENCE.activity, CADENCE.activityJitter),
    );
    this.payoutTimer = setTimeout(
      () => this.tickPayout(),
      this.rng.jitter(CADENCE.payout, CADENCE.payoutJitter),
    );
  }

  private applySeed(seed?: DemoSeed): void {
    if (!seed) return;
    if (seed.market && MARKETS[seed.market]) this.market = seed.market;
    if (typeof seed.farmers === 'number' && seed.farmers > 0) this.kpiRaw.farmers = seed.farmers;
    if (typeof seed.activePolicies === 'number' && seed.activePolicies > 0)
      this.kpiRaw.activePolicies = seed.activePolicies;
    if (typeof seed.premiums === 'number' && seed.premiums > 0) this.kpiRaw.premiums = seed.premiums;
    if (typeof seed.payouts === 'number' && seed.payouts >= 0) this.kpiRaw.payouts = seed.payouts;
    if (typeof seed.fees === 'number' && seed.fees > 0) this.kpiRaw.fees = seed.fees;
    this.recomputeLossRatio();
  }

  // -------------------------------------------------------------------------
  // Index ticker channel
  // -------------------------------------------------------------------------

  private initIndices(): void {
    this.indices = REGIONS.map((region) => {
      const kind = region.primaryIndex;
      const cfg = kind === 'NDVI' ? INDEX.ndvi : INDEX.rainfall;
      const value = this.rng.range(cfg.min + (cfg.max - cfg.min) * 0.25, cfg.min + (cfg.max - cfg.min) * 0.75);
      return {
        region,
        kind,
        value: kind === 'NDVI' ? Number(value.toFixed(2)) : Math.round(value),
        prev: value,
        timer: null,
      };
    });
    this.rebuildTickerSnapshot();
  }

  /** Stress: proximity to the "dry/dangerous" end (low NDVI OR low rainfall). */
  private stressFor(idx: IndexState): number {
    const cfg = idx.kind === 'NDVI' ? INDEX.ndvi : INDEX.rainfall;
    // Low value => high stress for both indices (drought framing).
    const norm = (idx.value - cfg.min) / (cfg.max - cfg.min);
    return clamp(1 - norm, 0, 1);
  }

  private tickIndex(idx: IndexState): void {
    const cfg = idx.kind === 'NDVI' ? INDEX.ndvi : INDEX.rainfall;
    idx.prev = idx.value;

    // Mean-reverting random walk: pull toward mean + bounded random step.
    const pull = (cfg.mean - idx.value) * cfg.reversion;
    const noise = this.rng.range(-cfg.step, cfg.step);
    let next = idx.value + pull + noise;
    next = clamp(next, cfg.min, cfg.max);
    idx.value = idx.kind === 'NDVI' ? Number(next.toFixed(2)) : Math.round(next);

    this.rebuildTickerSnapshot();
    this.emit(this.tickerListeners);

    if (this.running && !this.paused) {
      idx.timer = setTimeout(
        () => this.tickIndex(idx),
        this.rng.jitter(CADENCE.indexTick, CADENCE.indexTickJitter),
      );
    }
  }

  private rebuildTickerSnapshot(): void {
    const ts = Date.now();
    this.tickerSnapshot = this.indices.map((idx) => {
      const delta = idx.value - idx.prev;
      const base = idx.prev === 0 ? 1 : Math.abs(idx.prev);
      const deltaPct = Number(((delta / base) * 100).toFixed(1));
      return {
        regionId: idx.region.id,
        region: idx.region.name,
        market: idx.region.market,
        kind: idx.kind,
        value: idx.value,
        unit: idx.kind === 'RAINFALL' ? 'mm' : '',
        deltaPct,
        dir: direction(delta),
        stress: Number(this.stressFor(idx).toFixed(3)),
        ts,
      } satisfies IndexTick;
    });
  }

  // -------------------------------------------------------------------------
  // KPI channel
  // -------------------------------------------------------------------------

  private recomputeLossRatio(): void {
    const premiums = this.kpiRaw.premiums || 1;
    this.kpiRaw.lossRatio = clamp((this.kpiRaw.payouts / premiums) * 100, 0, 999);
  }

  private pushSpark(key: KpiKey): void {
    const arr = this.kpiSpark[key];
    arr.push(this.kpiRaw[key]);
    if (arr.length > SPARK_WINDOW) arr.shift();
  }

  private buildKpiSnapshot(): LiveKpis {
    const ts = Date.now();
    const make = (key: KpiKey): KpiMetric => {
      const isCurrency = MONEY_KEYS.includes(key);
      const pending = this.kpiPendingDelta[key];
      return {
        key,
        value: this.kpiRaw[key],
        currency: isCurrency ? MARKETS[this.market].currency : undefined,
        isCurrency,
        isPercent: key === 'lossRatio',
        lastDelta: pending?.delta ?? 0,
        deltaId: pending?.id ?? null,
        spark: [...this.kpiSpark[key]],
        ts,
      };
    };
    return {
      market: this.market,
      metrics: {
        farmers: make('farmers'),
        activePolicies: make('activePolicies'),
        lossRatio: make('lossRatio'),
        premiums: make('premiums'),
        payouts: make('payouts'),
        fees: make('fees'),
      },
    };
  }

  /**
   * Bump one or two metrics. `deltas` is applied to raw values; a pending delta
   * marker is set (with a fresh id) so the UI can fire a one-shot flash.
   */
  private bumpKpis(deltas: Partial<Record<KpiKey, number>>, flashKeys: KpiKey[]): void {
    // Clear previous pending markers first (one-shot semantics).
    (Object.keys(this.kpiPendingDelta) as KpiKey[]).forEach((k) => {
      this.kpiPendingDelta[k] = null;
    });

    (Object.entries(deltas) as [KpiKey, number][]).forEach(([key, delta]) => {
      this.kpiRaw[key] = Math.max(0, this.kpiRaw[key] + delta);
    });
    this.recomputeLossRatio();

    const id = uid(this.rng);
    flashKeys.forEach((key) => {
      this.kpiPendingDelta[key] = { delta: deltas[key] ?? 0, id: `${id}-${key}` };
    });

    // Record sparks for every metric so the sparkline always has fresh history.
    (Object.keys(this.kpiRaw) as KpiKey[]).forEach((k) => this.pushSpark(k));

    this.kpiSnapshot = this.buildKpiSnapshot();
    this.emit(this.kpiListeners);
  }

  private tickKpi(): void {
    // Up-biased organic drift: a policy sale adds premium + fee, occasionally a
    // new farmer / active policy. Payout steps are driven by payout events.
    const market = this.market;
    const crop = this.rng.pick<Crop>(['maize', 'sorghum', 'beans', 'millet', 'rice', 'cowpea']);
    const band = SUM_INSURED_BANDS[market][crop];
    const sumInsured = this.rng.range(band.min, band.max);
    const premium = sumInsured * this.rng.range(PREMIUM_RATE.min, PREMIUM_RATE.max);
    const fee = premium * FEE_RATE;

    const deltas: Partial<Record<KpiKey, number>> = {
      premiums: premium,
      fees: fee,
    };
    const flash: KpiKey[] = ['premiums', 'fees'];

    if (this.rng.chance(0.55)) {
      deltas.activePolicies = 1;
      flash.push('activePolicies');
    }
    if (this.rng.chance(0.3)) {
      deltas.farmers = this.rng.int(1, 2);
      flash.push('farmers');
    }

    this.bumpKpis(deltas, flash);

    if (this.running && !this.paused) {
      this.kpiTimer = setTimeout(
        () => this.tickKpi(),
        this.rng.jitter(CADENCE.kpiBump, CADENCE.kpiBumpJitter),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Activity + payout channels
  // -------------------------------------------------------------------------

  /** Pick a region weighted by market split × current stress (drought bias). */
  private pickRegion(preferHighStress = false): { region: Region; stress: number } {
    const stressById = new Map<string, number>();
    for (const idx of this.indices) stressById.set(idx.region.id, this.stressFor(idx));

    const region = this.rng.weightedPick(REGIONS, (r) => {
      const marketW = MARKET_WEIGHTS[r.market];
      const stress = stressById.get(r.id) ?? 0.3;
      // High-stress regions get more events; payouts skew even harder.
      const stressW = preferHighStress ? 0.2 + stress * stress * 3 : 0.5 + stress;
      return marketW * stressW;
    });
    return { region, stress: stressById.get(region.id) ?? 0.3 };
  }

  private buildEvent(type: DemoEventType): DemoEvent {
    const preferHigh = type === 'payout';
    const { region } = this.pickRegion(preferHigh);
    const market = region.market;
    const currency = MARKETS[market].currency;
    const crop = this.rng.pick<Crop>(region.crops);
    const band = SUM_INSURED_BANDS[market][crop];
    const sumInsured = this.rng.range(band.min, band.max);
    const peril: Peril = region.primaryIndex === 'RAINFALL' ? 'drought' : this.rng.chance(0.5) ? 'drought' : 'flood';

    const first = this.rng.pick(FARMER_FIRST_NAMES);
    const initial = this.rng.pick(FARMER_LAST_INITIALS);
    const farmerMasked = maskName(first, initial);

    let amount = 0;
    let determinationRef: string | undefined;
    let evPeril: Peril | undefined;

    if (type === 'policy') {
      amount = Math.round(sumInsured);
    } else if (type === 'determination') {
      evPeril = peril;
      determinationRef = shortRef(this.rng);
      // Most determinations find no shortfall; occasionally a small one.
      amount = this.rng.chance(0.35)
        ? Math.round(sumInsured * this.rng.range(PAYOUT_FRACTION.min, PAYOUT_FRACTION.max))
        : 0;
    } else {
      // payout
      evPeril = peril;
      determinationRef = shortRef(this.rng);
      amount = Math.round(sumInsured * this.rng.range(PAYOUT_FRACTION.min, PAYOUT_FRACTION.max));
    }

    return {
      id: uid(this.rng),
      type,
      market,
      region: region.name,
      regionId: region.id,
      crop,
      peril: evPeril,
      amount,
      currency,
      farmerMasked,
      determinationRef,
      ts: Date.now(),
    };
  }

  private prependActivity(event: DemoEvent): void {
    this.activity = [event, ...this.activity].slice(0, BUFFERS.activityMax);
    this.activitySnapshot = this.activity;
    this.emit(this.activityListeners);
  }

  private tickActivity(): void {
    const roll = this.rng.next();
    let type: DemoEventType;
    if (roll < EVENT_MIX.policy) type = 'policy';
    else if (roll < EVENT_MIX.policy + EVENT_MIX.determination) type = 'determination';
    else type = 'payout';

    const event = this.buildEvent(type);
    this.prependActivity(event);

    // A payout that surfaces via the activity roll also drives the payout channel
    // (toast + amber KPI step). KPI premium/fee drift is owned by `tickKpi`.
    if (type === 'payout') {
      this.firePayout(event);
    }

    if (this.running && !this.paused) {
      this.activityTimer = setTimeout(
        () => this.tickActivity(),
        this.rng.jitter(CADENCE.activity, CADENCE.activityJitter),
      );
    }
  }

  /** Turn a payout DemoEvent into a richer PayoutEvent + KPI amber step. */
  private firePayout(event: DemoEvent): void {
    const payout: PayoutEvent = {
      ...event,
      type: 'payout',
      peril: event.peril ?? 'drought',
      farmersPaid: this.rng.int(1, 3),
    };
    this.payoutHistory = [payout, ...this.payoutHistory].slice(0, BUFFERS.payoutHistoryMax);
    this.payoutSnapshot = { latest: payout, history: this.payoutHistory };
    this.emit(this.payoutListeners);

    // Payouts KPI card does a discrete amber step.
    this.bumpKpis({ payouts: payout.amount }, ['payouts']);
  }

  private tickPayout(): void {
    // Dedicated payout cadence: weighted toward high-stress regions.
    const event = this.buildEvent('payout');
    this.prependActivity(event);
    this.firePayout(event);

    if (this.running && !this.paused) {
      // If overall stress is high, fire a bit sooner.
      const avgStress =
        this.indices.reduce((s, i) => s + this.stressFor(i), 0) / (this.indices.length || 1);
      const speedUp = avgStress > STRESS_PAYOUT_THRESHOLD ? 0.6 : 1;
      this.payoutTimer = setTimeout(
        () => this.tickPayout(),
        this.rng.jitter(CADENCE.payout, CADENCE.payoutJitter) * speedUp,
      );
    }
  }

  // -------------------------------------------------------------------------
  // subscription surface (useSyncExternalStore)
  // -------------------------------------------------------------------------

  private emit(listeners: Set<() => void>): void {
    listeners.forEach((cb) => cb());
  }

  subscribeTicker(cb: () => void): () => void {
    this.tickerListeners.add(cb);
    return () => this.tickerListeners.delete(cb);
  }
  getTicker(): IndexTick[] {
    return this.tickerSnapshot;
  }

  subscribeKpis(cb: () => void): () => void {
    this.kpiListeners.add(cb);
    return () => this.kpiListeners.delete(cb);
  }
  getKpis(): LiveKpis {
    return this.kpiSnapshot;
  }

  subscribeActivity(cb: () => void): () => void {
    this.activityListeners.add(cb);
    return () => this.activityListeners.delete(cb);
  }
  getActivity(): DemoEvent[] {
    return this.activitySnapshot;
  }

  subscribePayouts(cb: () => void): () => void {
    this.payoutListeners.add(cb);
    return () => this.payoutListeners.delete(cb);
  }
  getPayouts(): { latest: PayoutEvent | null; history: PayoutEvent[] } {
    return this.payoutSnapshot;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let engineInstance: Engine | null = null;

/** Returns the process-wide engine singleton (created lazily). */
export function getEngine(): SimulationEngine {
  if (!engineInstance) engineInstance = new Engine();
  return engineInstance;
}

/** Test-only: dispose the singleton so timers/listeners don't leak between tests. */
export function __resetEngineForTests(): void {
  if (engineInstance) engineInstance.stop();
  engineInstance = null;
}
