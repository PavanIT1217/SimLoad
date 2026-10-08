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

/** z-scores of common percentiles of the standard normal distribution. */
export const PERCENTILE_Z: Readonly<Record<number, number>> = {
  75: 0.6745,
  90: 1.2816,
  95: 1.6449,
  99: 2.3263,
  99.9: 3.0902,
};

/**
 * Lognormal fit from the median and any one upper percentile (90, 95, 99, …),
 * e.g. when a load-test tool only reports p95.
 */
export function fitFromPercentile(p50Ms: number, percentile: number, valueMs: number): LatencyFit {
  const z = PERCENTILE_Z[percentile];
  if (z === undefined) throw new RangeError(`Unsupported percentile p${percentile}`);
  if (!(p50Ms > 0) || !(valueMs >= p50Ms)) throw new RangeError('Need 0 < p50 <= upper percentile');
  const sigma = Math.log(valueMs / p50Ms) / z;
  return { medianMs: p50Ms, sigma, count: 0, p50: p50Ms, p99: p50Ms * Math.exp(sigma * Z_P99) };
}
