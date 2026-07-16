/**
 * DemoModeProvider — the single gate for the client-side demo simulation.
 *
 * `enabled = import.meta.env.VITE_DEMO_MODE === 'true'` (OFF by default, so
 * production is untouched). When enabled it lazy-`import()`s the simulation
 * engine — keeping the engine and all sim code OUT of the production bundle —
 * reads a one-time seed baseline from the existing dashboard queries + the
 * active org market, and calls `engine.start(seed)`. On unmount it stops the
 * engine and clears all timers.
 *
 * When disabled the provider is a transparent pass-through: `enabled:false`, a
 * no-op engine, no timers, no dynamic import. Consumers do
 * `const { enabled } = useDemoMode(); if (!enabled) return ...` to guarantee
 * zero behavioral change in production.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMarket } from '@/lib/market';
import type {
  DemoSeed,
  IndexTick,
  LiveKpis,
  DemoEvent,
  MarketCode,
  PayoutEvent,
  SimulationEngine,
} from './types';

// ---------------------------------------------------------------------------
// No-op engine (used before the real engine lazy-loads, and never mutated).
// Its getters return referentially-stable empties so useSyncExternalStore is
// happy and nothing renders/ticks.
// ---------------------------------------------------------------------------

const EMPTY_TICKS: IndexTick[] = [];
const EMPTY_EVENTS: DemoEvent[] = [];
const EMPTY_PAYOUTS: { latest: PayoutEvent | null; history: PayoutEvent[] } = {
  latest: null,
  history: [],
};
const EMPTY_KPIS: LiveKpis = {
  market: 'KE',
  metrics: {
    farmers: { key: 'farmers', value: 0, isCurrency: false, isPercent: false, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
    activePolicies: { key: 'activePolicies', value: 0, isCurrency: false, isPercent: false, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
    lossRatio: { key: 'lossRatio', value: 0, isCurrency: false, isPercent: true, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
    premiums: { key: 'premiums', value: 0, currency: 'KES', isCurrency: true, isPercent: false, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
    payouts: { key: 'payouts', value: 0, currency: 'KES', isCurrency: true, isPercent: false, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
    fees: { key: 'fees', value: 0, currency: 'KES', isCurrency: true, isPercent: false, lastDelta: 0, deltaId: null, spark: [], ts: 0 },
  },
};

const NOOP_ENGINE: SimulationEngine = {
  start() {},
  stop() {},
  isRunning: () => false,
  subscribeTicker: () => () => {},
  getTicker: () => EMPTY_TICKS,
  subscribeKpis: () => () => {},
  getKpis: () => EMPTY_KPIS,
  subscribeActivity: () => () => {},
  getActivity: () => EMPTY_EVENTS,
  subscribePayouts: () => () => {},
  getPayouts: () => EMPTY_PAYOUTS,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface DemoModeContextValue {
  enabled: boolean;
  engine: SimulationEngine;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  enabled: false,
  engine: NOOP_ENGINE,
});

/** Read the compile-time demo flag. Falsey / absent everywhere but `.env.demo`. */
export const DEMO_MODE_ENABLED: boolean =
  import.meta.env.VITE_DEMO_MODE === 'true';

/** Narrow a market ISO code to the demo's supported MarketCode union. */
function toMarketCode(code?: string | null): MarketCode {
  return code === 'GH' ? 'GH' : 'KE';
}

interface OrgStatsLike {
  totalFarmers?: number;
  activePolicies?: number;
  totalPremiums?: number;
  totalPayouts?: number;
  totalFees?: number;
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const enabled = DEMO_MODE_ENABLED;

  // Real engine, populated after lazy load. Falls back to the no-op stub.
  const [engine, setEngine] = useState<SimulationEngine>(NOOP_ENGINE);

  // Seed sources — only meaningful when enabled; hooks are cheap when not.
  const queryClient = useQueryClient();
  const { market } = useMarket();

  // Build a one-time seed baseline from the existing dashboard query cache.
  const seed = useMemo<DemoSeed>(() => {
    if (!enabled) return {};
    const stats = queryClient.getQueryData<OrgStatsLike>(['orgStats']);
    return {
      farmers: stats?.totalFarmers,
      activePolicies: stats?.activePolicies,
      premiums: stats?.totalPremiums,
      payouts: stats?.totalPayouts,
      fees: stats?.totalFees,
      market: toMarketCode(market?.code),
    };
    // Re-derive when the org market resolves (KE default → real market).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, market?.code]);

  // Lazy-load + start the engine when enabled; stop on unmount.
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let active: SimulationEngine | null = null;

    import('./engine')
      .then(({ getEngine }) => {
        if (disposed) return;
        const e = getEngine();
        e.start(seed);
        active = e;
        setEngine(e);
      })
      .catch(() => {
        /* Demo is best-effort; never break the app if the engine fails to load. */
      });

    return () => {
      disposed = true;
      active?.stop();
    };
    // Start once on mount; seed refresh handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Refresh the seed baseline once the real market/stats resolve. `start()` is
  // idempotent and re-applies the seed without restarting timers.
  useEffect(() => {
    if (!enabled) return;
    if (engine === NOOP_ENGINE) return;
    engine.start(seed);
  }, [enabled, engine, seed]);

  const value = useMemo<DemoModeContextValue>(
    () => ({ enabled, engine: enabled ? engine : NOOP_ENGINE }),
    [enabled, engine],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

/** Access demo state. `enabled` gates every demo component; `engine` powers hooks. */
export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
