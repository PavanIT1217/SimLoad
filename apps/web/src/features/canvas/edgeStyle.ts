/** Stroke width grows with log10(rps): 1 req/s ~1px, 100M req/s ~5px. */
export function strokeWidthFor(rps: number): number {
  return 1 + Math.log10(Math.max(1, rps)) / 2;
}

/** Particles travelling along an edge: 1 at low flow, up to 4 at earth scale. */
export function particleCount(rps: number): number {
  return Math.max(1, Math.min(4, Math.ceil(Math.log10(Math.max(1, rps)) / 2)));
}

/** Seconds for one particle to traverse an edge: faster with more flow, in 0.5s steps. */
export function particleDuration(rps: number): number {
  const seconds = Math.max(1, 3.5 - Math.log10(Math.max(1, rps)) * 0.3);
  return Math.round(seconds * 2) / 2;
}
