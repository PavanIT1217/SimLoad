import { Z_P99 } from '../util/math';
import { percentile } from './percentiles';

/** Lognormal latency parameters in the form nodes use them. */
export interface LatencyFit {
  /** Median latency, maps to `baseLatencyMs`. */
  medianMs: number;
  /** Log-space standard deviation, maps to `latencySigma`. */
  sigma: number;
  count: number;
  p50: number;
  p99: number;
}

/**
 * Derives lognormal parameters from two measured percentiles:
 * median = p50 and sigma = ln(p99 / p50) / z(0.99).
 */
export function fitFromPercentiles(p50Ms: number, p99Ms: number): LatencyFit {
  if (!(p50Ms > 0) || !(p99Ms > 0)) throw new RangeError('Percentiles must be positive');
  if (p99Ms < p50Ms) throw new RangeError('p99 must be >= p50');
  const sigma = Math.log(p99Ms / p50Ms) / Z_P99;
  return { medianMs: p50Ms, sigma, count: 0, p50: p50Ms, p99: p99Ms };
}

/**
 * Maximum-likelihood lognormal fit of raw latency samples (non-positive and
 * non-finite values are ignored). mu = mean(ln x), sigma = stddev(ln x).
 */
export function fitLognormal(samples: readonly number[]): LatencyFit {
  const valid = samples.filter((x) => Number.isFinite(x) && x > 0);
  if (valid.length < 2) throw new RangeError('Need at least two positive samples');
  const logs = valid.map(Math.log);
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (logs.length - 1);
  const sorted = [...valid].sort((a, b) => a - b);
  return {
    medianMs: Math.exp(mu),
    sigma: Math.sqrt(variance),
    count: valid.length,
    p50: percentile(sorted, 50),
    p99: percentile(sorted, 99),
  };
}
