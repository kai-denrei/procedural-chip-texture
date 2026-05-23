/**
 * Seeded pseudo-random number generator.
 *
 * Pipeline rule: NO `Math.random()` in `src/gen/` or `src/render/`. Every byte
 * of entropy in the generator must descend from a user-supplied seed so that a
 * given seed always produces the same chip — this is the foundation of both
 * the regenerate-by-seed UX and any future golden-seed visual regression test.
 *
 * Algorithm: mulberry32. Tiny, fast, public-domain, good enough for visuals.
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */

export interface Rng {
  /** Next uniform float in [0, 1). */
  next(): number;
  /** Next uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Next integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Coin flip with probability `p` of true (default 0.5). */
  chance(p?: number): boolean;
  /** Pick a uniform element from an array. */
  pick<T>(arr: readonly T[]): T;
  /** Fork a derived RNG with a salt — lets sub-stages have independent streams. */
  fork(salt: number): Rng;
  /** Read the current 32-bit state (mostly for debugging). */
  state(): number;
}

/** Hash a string seed to a 32-bit unsigned int (xfnv1a variant). */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // A final avalanche to spread bits.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Create a mulberry32 RNG from a 32-bit seed or a string. */
export function makeRng(seed: number | string): Rng {
  let s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
  if (s === 0) s = 0x9e3779b9; // golden-ratio constant — avoid the degenerate zero state

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p = 0.5) => next() < p,
    pick: <T,>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error('pick: empty array');
      return arr[Math.floor(next() * arr.length)]!;
    },
    fork: (salt: number) => {
      // Mix current state with the salt to derive a child seed.
      const child = (s ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
      return makeRng(child);
    },
    state: () => s,
  };
  return rng;
}
