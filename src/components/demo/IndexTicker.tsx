/**
 * IndexTicker — a slim, FX-style scrolling ribbon of KE + GH regional climate
 * indices (NDVI / rainfall), each with a live value and a green/red delta.
 *
 * It renders ONLY when demo mode is on (`useDemoMode().enabled` — enforced both
 * here and inside every `useIndexTicker()` read), so production is untouched.
 * The whole strip is client-side eye-candy layered on the seeded demo data: it
 * showcases BOTH markets (Kenya + Ghana) as a living "market of climate risk".
 *
 * Motion: a CSS marquee (transform translate, GPU-friendly) that pauses on
 * hover. Under `prefers-reduced-motion` it degrades to a static, horizontally
 * scrollable row (no animation).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useDemoMode, useIndexTicker } from '@/lib/demo';
import type { IndexTick } from '@/lib/demo';
import { SimulationBadge } from './SimulationBadge';

/** Flag glyph for a market — decorative only, never used for currency. */
const MARKET_FLAG: Record<string, string> = { KE: '🇰🇪', GH: '🇬🇭' };

const DELTA_CLASS: Record<IndexTick['dir'], string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

const DELTA_ARROW: Record<IndexTick['dir'], string> = {
  up: '▲',
  down: '▼',
  flat: '▪',
};

/** Format an index reading: NDVI to 2dp, rainfall as an integer + unit. */
function formatValue(tick: IndexTick): string {
  const num = tick.kind === 'NDVI' ? tick.value.toFixed(2) : String(Math.round(tick.value));
  return tick.unit ? `${num}${tick.unit}` : num;
}

function IndexChip({ tick }: { tick: IndexTick }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 text-xs tabular-nums">
      <span aria-hidden="true" className="text-sm leading-none">
        {MARKET_FLAG[tick.market] ?? ''}
      </span>
      <span className="font-semibold text-foreground">{tick.region}</span>
      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {tick.kind === 'RAINFALL' ? 'RAIN' : 'NDVI'}
      </span>
      <span className="font-medium text-foreground">{formatValue(tick)}</span>
      <span className={cn('font-semibold', DELTA_CLASS[tick.dir])}>
        {DELTA_ARROW[tick.dir]} {Math.abs(tick.deltaPct).toFixed(1)}%
      </span>
    </span>
  );
}

/** Detect prefers-reduced-motion, reactively. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export function IndexTicker() {
  const { enabled } = useDemoMode();
  const ticks = useIndexTicker();
  const reducedMotion = useReducedMotion();

  // Self-null when demo mode is off — production layout stays identical.
  if (!enabled) return null;

  const hasTicks = ticks.length > 0;
  // Keep marquee speed consistent regardless of how many regions are on the
  // board: scale duration with the item count (with a sane floor).
  const durationSec = Math.max(40, ticks.length * 4);

  return (
    <div className="sticky top-16 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Scoped keyframes so we don't touch the global stylesheet/tailwind config. */}
      <style>{`
        @keyframes mc-index-ticker-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .mc-ticker-track {
          animation: mc-index-ticker-marquee var(--mc-ticker-duration, 60s) linear infinite;
          will-change: transform;
        }
        .mc-ticker-viewport:hover .mc-ticker-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .mc-ticker-track { animation: none; }
        }
      `}</style>

      <div className="flex h-8 items-stretch">
        {/* Leading, always-visible SIMULATION marker (self-nulls off). */}
        <div className="flex shrink-0 items-center gap-2 border-r bg-warning/10 pl-3 pr-3">
          <SimulationBadge variant="pill" className="border-none bg-transparent px-0 py-0" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-warning/80 sm:inline">
            Climate Index
          </span>
        </div>

        {/* Ticker viewport */}
        <div className="mc-ticker-viewport relative flex-1 overflow-hidden">
          {!hasTicks ? (
            <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
              Priming market feed…
            </div>
          ) : reducedMotion ? (
            // Static, scrollable fallback — no motion.
            <div className="scrollbar-thin flex h-full items-center gap-1 overflow-x-auto">
              {ticks.map((t) => (
                <IndexChip key={t.regionId + t.kind} tick={t} />
              ))}
            </div>
          ) : (
            // Seamless marquee: two copies of the board translate by -50%.
            <div
              className="mc-ticker-track flex h-full min-w-max items-center"
              style={{ ['--mc-ticker-duration' as string]: `${durationSec}s` }}
            >
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="flex items-center"
                  aria-hidden={copy === 1 ? 'true' : undefined}
                >
                  {ticks.map((t) => (
                    <IndexChip key={`${copy}-${t.regionId}-${t.kind}`} tick={t} />
                  ))}
                </div>
              ))}
            </div>
          )}
          {/* Edge fades for the FX-ribbon feel. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default IndexTicker;
