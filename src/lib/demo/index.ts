/**
 * Public surface for the demo simulation, for UI agents to import from
 * a single place: `@/lib/demo`.
 *
 * NOTE: This barrel intentionally does NOT re-export the engine module, so
 * importing hooks/provider does not statically pull the engine into the bundle.
 * The engine is only ever loaded via the dynamic `import('./engine')` inside
 * `DemoModeProvider` when `VITE_DEMO_MODE === 'true'`.
 */

export { DemoModeProvider, useDemoMode, DEMO_MODE_ENABLED } from './DemoModeProvider';
export type { DemoModeContextValue } from './DemoModeProvider';

export {
  useIndexTicker,
  useLiveKpis,
  useActivityStream,
  usePayoutEvents,
} from './hooks';

export { useAnimatedNumber } from './useAnimatedNumber';

export type {
  MarketCode,
  Direction,
  IndexKind,
  Crop,
  Peril,
  Region,
  IndexTick,
  KpiKey,
  KpiMetric,
  LiveKpis,
  DemoEventType,
  DemoEvent,
  PayoutEvent,
  DemoSeed,
  SimulationEngine,
} from './types';
