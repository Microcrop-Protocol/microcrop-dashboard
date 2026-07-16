/**
 * Tiny seedable PRNG + sampling helpers for the demo engine.
 *
 * No dependencies. `mulberry32` gives a repeatable stream when seeded, so demos
 * can be deterministic if desired; the engine defaults to a time-based seed.
 */

/** Deterministic 32-bit PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A minimal RNG bundle threaded through the engine. */
export interface Rng {
  /** float in [0, 1). */
  next(): number;
  /** float in [min, max). */
  range(min: number, max: number): number;
  /** integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** true with the given probability p (0..1). */
  chance(p: number): boolean;
  /** uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** weighted pick; `weight` maps item -> non-negative weight. */
  weightedPick<T>(items: readonly T[], weight: (item: T) => number): T;
  /** symmetric jitter: base scaled by (1 ± pct). */
  jitter(base: number, pct: number): number;
}

export function createRng(seed: number): Rng {
  const rand = mulberry32(seed);
  const range = (min: number, max: number) => min + rand() * (max - min);
  const int = (min: number, max: number) => Math.floor(range(min, max + 1));
  return {
    next: rand,
    range,
    int,
    chance: (p: number) => rand() < p,
    pick<T>(items: readonly T[]): T {
      return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
    },
    weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
      const weights = items.map((i) => Math.max(0, weight(i)));
      const total = weights.reduce((s, w) => s + w, 0);
      if (total <= 0) return items[Math.floor(rand() * items.length)];
      let r = rand() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    jitter(base: number, pct: number): number {
      const delta = base * pct;
      return base - delta + rand() * (2 * delta);
    },
  };
}

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
