/**
 * useAnimatedNumber — interpolate a displayed number toward a target using
 * requestAnimationFrame, so live KPI values "breathe" instead of jumping.
 *
 * Lightweight (no deps). Respects `prefers-reduced-motion`: when the user
 * prefers reduced motion, it snaps to the target instantly. `tabular-nums`
 * on the rendering element keeps width stable — this hook only returns a value.
 */

import { useEffect, useRef, useState } from 'react';

export type Easing = 'linear' | 'easeOut';

interface Options {
  durationMs?: number;
  easing?: Easing;
  /** Below this absolute delta the value snaps (avoids endless tiny frames). */
  epsilon?: number;
}

function ease(t: number, kind: Easing): number {
  if (kind === 'easeOut') return 1 - Math.pow(1 - t, 3);
  return t;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Returns a number that animates from its current display value to `target`
 * whenever `target` changes.
 */
export function useAnimatedNumber(target: number, options?: Options): number {
  const { durationMs = 800, easing = 'easeOut', epsilon = 0.5 } = options ?? {};
  const [display, setDisplay] = useState(target);
  const frameRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const displayRef = useRef(target);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    // Snap instantly for reduced motion, tiny deltas, or non-finite targets.
    if (!Number.isFinite(target) || prefersReducedMotion() || Math.abs(target - displayRef.current) < epsilon) {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      setDisplay(target);
      return;
    }

    fromRef.current = displayRef.current;
    startRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const value = fromRef.current + (target - fromRef.current) * ease(t, easing);
      setDisplay(value);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setDisplay(target);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, easing, epsilon]);

  return display;
}
