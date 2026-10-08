export interface LatencySummary {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  max: number;
  count: number;
}

export const EMPTY_SUMMARY: LatencySummary = { p50: 0, p95: 0, p99: 0, mean: 0, max: 0, count: 0 };

/**
 * Percentile of an ascending-sorted array using linear interpolation
 * between closest ranks. `p` is in 0..100.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (rank - lo);
}

/** Summarises a set of latency samples (input is not modified). */
export function summarize(values: readonly number[]): LatencySummary {
  if (values.length === 0) return EMPTY_SUMMARY;
  const sorted = [...values].sort((x, y) => x - y);
  let total = 0;
  for (const v of sorted) total += v;
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean: total / sorted.length,
    max: sorted[sorted.length - 1] as number,
    count: sorted.length,
  };
}
