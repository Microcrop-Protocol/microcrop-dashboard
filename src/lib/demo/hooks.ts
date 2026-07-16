/**
 * React subscription hooks for the demo simulation engine.
 *
 * Each hook binds to one engine channel via `useSyncExternalStore`, so a change
 * on one channel only re-renders components subscribed to that channel. When
 * demo mode is OFF (`useDemoMode().enabled === false`) every hook returns a
 * stable empty/no-op value and NEVER subscribes — nothing runs in production.
 *
 * The engine is lazy-loaded by `DemoModeProvider`; these hooks read the live
 * instance off the demo context, so they never statically import the engine
 * into the production bundle.
 */

import { useSyncExternalStore } from 'react';
import { useDemoMode } from './DemoModeProvider';
import type {
  DemoEvent,
  IndexTick,
  LiveKpis,
  PayoutEvent,
  SimulationEngine,
} from './types';

// ---- Stable empty snapshots (referentially constant for useSyncExternalStore) ----

const EMPTY_TICKS: IndexTick[] = [];
const EMPTY_EVENTS: DemoEvent[] = [];
const EMPTY_PAYOUTS: { latest: PayoutEvent | null; history: PayoutEvent[] } = {
  latest: null,
  history: [],
};
const EMPTY_KPIS: LiveKpis = {
  market: 'KE',
  metrics: {
    farmers: kpiStub('farmers'),
    activePolicies: kpiStub('activePolicies'),
    lossRatio: kpiStub('lossRatio', false, true),
    premiums: kpiStub('premiums', true),
    payouts: kpiStub('payouts', true),
    fees: kpiStub('fees', true),
  },
};

function kpiStub(
  key: LiveKpis['metrics'][keyof LiveKpis['metrics']]['key'],
  isCurrency = false,
  isPercent = false,
): LiveKpis['metrics'][keyof LiveKpis['metrics']] {
  return {
    key,
    value: 0,
    currency: isCurrency ? 'KES' : undefined,
    isCurrency,
    isPercent,
    lastDelta: 0,
    deltaId: null,
    spark: [],
    ts: 0,
  };
}

const NOOP_UNSUB = () => {};

/**
 * Resolve the live engine when enabled; otherwise null. Returns from the demo
 * context so nothing is imported/instantiated when disabled.
 */
function useEngineOrNull(): SimulationEngine | null {
  const { enabled, engine } = useDemoMode();
  return enabled ? engine : null;
}

// ---------------------------------------------------------------------------
// (a) Index ticker — full board, updates in place
// ---------------------------------------------------------------------------

export function useIndexTicker(): IndexTick[] {
  const engine = useEngineOrNull();
  return useSyncExternalStore(
    engine ? (cb) => engine.subscribeTicker(cb) : () => NOOP_UNSUB,
    () => (engine ? engine.getTicker() : EMPTY_TICKS),
    () => EMPTY_TICKS,
  );
}

// ---------------------------------------------------------------------------
// (b) Live KPIs
// ---------------------------------------------------------------------------

export function useLiveKpis(): LiveKpis {
  const engine = useEngineOrNull();
  return useSyncExternalStore(
    engine ? (cb) => engine.subscribeKpis(cb) : () => NOOP_UNSUB,
    () => (engine ? engine.getKpis() : EMPTY_KPIS),
    () => EMPTY_KPIS,
  );
}

// ---------------------------------------------------------------------------
// (c) Activity stream — newest-first, capped
// ---------------------------------------------------------------------------

export function useActivityStream(opts?: { max?: number }): DemoEvent[] {
  const engine = useEngineOrNull();
  const all = useSyncExternalStore(
    engine ? (cb) => engine.subscribeActivity(cb) : () => NOOP_UNSUB,
    () => (engine ? engine.getActivity() : EMPTY_EVENTS),
    () => EMPTY_EVENTS,
  );
  const max = opts?.max;
  // Slice only when a cap is requested AND it would actually trim; otherwise
  // return the stable reference so re-renders stay cheap.
  if (max != null && all.length > max) return all.slice(0, max);
  return all;
}

// ---------------------------------------------------------------------------
// (d) Payout events — latest + capped history
// ---------------------------------------------------------------------------

export function usePayoutEvents(): { latest: PayoutEvent | null; history: PayoutEvent[] } {
  const engine = useEngineOrNull();
  return useSyncExternalStore(
    engine ? (cb) => engine.subscribePayouts(cb) : () => NOOP_UNSUB,
    () => (engine ? engine.getPayouts() : EMPTY_PAYOUTS),
    () => EMPTY_PAYOUTS,
  );
}
