/** Seeded pseudo-random number generator. All engine randomness flows through this. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Standard normal draw. */
  normal(): number;
  /** Lognormal draw with the given median and log-space sigma. */
  lognormal(median: number, sigma: number): number;
  /** Index drawn with probability proportional to `weights`. */
  weightedIndex(weights: readonly number[]): number;
}

/** mulberry32: tiny, fast, and good enough for simulation sampling. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (): number => {
    // Box-Muller; 1 - next() keeps the log argument in (0, 1].
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    normal,
    lognormal(median, sigma) {
      if (median <= 0) return 0;
      if (sigma <= 0) return median;
      return median * Math.exp(sigma * normal());
    },
    weightedIndex(weights) {
      let total = 0;
      for (const w of weights) total += w;
      if (total <= 0) return -1;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i] ?? 0;
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
  };
}
