/**
 * SimulationBadge — a small, persistent "◉ SIMULATION — demo data" marker.
 *
 * Renders ONLY when demo mode is on (`useDemoMode().enabled`), so production is
 * byte-for-byte unaffected. Two shapes:
 *   - `pill`   (default): a compact rounded pill, e.g. for the app header.
 *   - `banner`: a full-width slim strip, e.g. above the index ticker.
 *
 * Purely presentational + client-side. It exists so the live "market of climate
 * risk" simulation can never be mistaken for real, production data.
 */

import { cn } from '@/lib/utils';
import { useDemoMode } from '@/lib/demo';

interface SimulationBadgeProps {
  variant?: 'pill' | 'banner';
  className?: string;
}

/** Pulsing status dot. The global reduced-motion rule halts the pulse. */
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
    </span>
  );
}

export function SimulationBadge({ variant = 'pill', className }: SimulationBadgeProps) {
  const { enabled } = useDemoMode();
  if (!enabled) return null;

  if (variant === 'banner') {
    return (
      <div
        role="status"
        aria-label="Simulation mode — demo data"
        className={cn(
          'flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1 text-warning',
          className,
        )}
      >
        <LiveDot />
        <span className="text-[11px] font-semibold uppercase tracking-widest">
          Simulation
        </span>
        <span className="text-[11px] font-medium tracking-wide text-warning/80">
          — live demo data, not real transactions
        </span>
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-label="Simulation mode — demo data"
      title="Live client-side demo simulation — no real money or on-chain activity"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning',
        className,
      )}
    >
      <LiveDot />
      Simulation
    </span>
  );
}

export default SimulationBadge;
