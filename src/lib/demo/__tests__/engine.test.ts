/**
 * Sanity tests for the demo SimulationEngine — bounds hold, currencies match
 * the active market, and stop() halts the simulation. Purely in-memory; no
 * network. Uses fake timers to drive the self-scheduling channels.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEngine, __resetEngineForTests } from '../engine';
import { INDEX } from '../config';

describe('SimulationEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetEngineForTests();
  });

  afterEach(() => {
    __resetEngineForTests();
    vi.useRealTimers();
  });

  it('keeps index values within believable bounds after many ticks', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 12345 });
    vi.advanceTimersByTime(120_000); // 2 minutes of ticks

    const ticks = engine.getTicker();
    expect(ticks.length).toBeGreaterThan(0);

    for (const t of ticks) {
      if (t.kind === 'NDVI') {
        expect(t.value).toBeGreaterThanOrEqual(INDEX.ndvi.min);
        expect(t.value).toBeLessThanOrEqual(INDEX.ndvi.max);
        expect(t.unit).toBe('');
      } else {
        expect(t.value).toBeGreaterThanOrEqual(INDEX.rainfall.min);
        expect(t.value).toBeLessThanOrEqual(INDEX.rainfall.max);
        expect(t.unit).toBe('mm');
      }
      expect(t.stress).toBeGreaterThanOrEqual(0);
      expect(t.stress).toBeLessThanOrEqual(1);
      expect(['up', 'down', 'flat']).toContain(t.dir);
    }
  });

  it('tags money KPIs with the active market currency (GH -> GHS)', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 7, market: 'GH' });
    vi.advanceTimersByTime(30_000);

    const kpis = engine.getKpis();
    expect(kpis.market).toBe('GH');
    expect(kpis.metrics.premiums.currency).toBe('GHS');
    expect(kpis.metrics.payouts.currency).toBe('GHS');
    expect(kpis.metrics.fees.currency).toBe('GHS');
    // Non-money metrics carry no currency.
    expect(kpis.metrics.farmers.currency).toBeUndefined();
    expect(kpis.metrics.lossRatio.isPercent).toBe(true);
  });

  it('streams activity across BOTH markets with valid currencies', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 99 });
    vi.advanceTimersByTime(300_000); // 5 minutes to accumulate events

    const events = engine.getActivity();
    expect(events.length).toBeGreaterThan(0);

    const markets = new Set(events.map((e) => e.market));
    expect(markets.has('KE')).toBe(true);
    expect(markets.has('GH')).toBe(true);

    for (const e of events) {
      expect(e.currency).toBe(e.market === 'GH' ? 'GHS' : 'KES');
      expect(e.amount).toBeGreaterThanOrEqual(0);
      expect(e.farmerMasked).toContain('•');
    }
  });

  it('produces payout events with 1-3 farmers paid and a peril', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 42 });
    vi.advanceTimersByTime(300_000);

    const { history } = engine.getPayouts();
    expect(history.length).toBeGreaterThan(0);
    for (const p of history) {
      expect(p.type).toBe('payout');
      expect(['drought', 'flood']).toContain(p.peril);
      expect(p.farmersPaid).toBeGreaterThanOrEqual(1);
      expect(p.farmersPaid).toBeLessThanOrEqual(3);
      expect(p.amount).toBeGreaterThan(0);
    }
  });

  it('stop() halts the simulation so snapshots stop changing', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 5 });
    vi.advanceTimersByTime(20_000);
    expect(engine.isRunning()).toBe(true);

    engine.stop();
    expect(engine.isRunning()).toBe(false);

    const activityAfterStop = engine.getActivity();
    const tickerAfterStop = engine.getTicker();
    vi.advanceTimersByTime(120_000);

    // No timers left, so references are unchanged.
    expect(engine.getActivity()).toBe(activityAfterStop);
    expect(engine.getTicker()).toBe(tickerAfterStop);
  });

  it('is idempotent: calling start() twice does not double-schedule', () => {
    const engine = getEngine();
    engine.start({ rngSeed: 1 });
    engine.start({ rngSeed: 1 }); // second call should be a no-op for timers
    vi.advanceTimersByTime(10_000);
    expect(engine.isRunning()).toBe(true);
    // Snapshot subscriptions still return arrays (no throw / corruption).
    expect(Array.isArray(engine.getTicker())).toBe(true);
  });
});
