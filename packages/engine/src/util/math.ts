export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Error function, Abramowitz & Stegun 7.1.26 (max error 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Standard normal cumulative distribution function. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** z-score of the 99th percentile of a standard normal. */
export const Z_P99 = 2.3263478740408408;

/** Mean of a lognormal distribution with the given median and sigma. */
export function lognormalMean(median: number, sigma: number): number {
  return median * Math.exp((sigma * sigma) / 2);
}

/**
 * P(shift + X > threshold) where X is lognormal with the given median and sigma.
 * Used to estimate the fraction of requests that exceed a timeout.
 */
export function lognormalExceedance(
  median: number,
  sigma: number,
  shift: number,
  threshold: number,
): number {
  const room = threshold - shift;
  if (room <= 0) return 1;
  if (median <= 0) return 0;
  if (sigma <= 0) return median > room ? 1 : 0;
  return 1 - normalCdf(Math.log(room / median) / sigma);
}
