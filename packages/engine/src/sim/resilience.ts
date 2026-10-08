import type { DesignNode } from '../model/types';
import { retryFactor, successWithRetries } from './components';
import type { NodeRuntime } from './state';

/** Share of traffic a half-open breaker lets through to probe recovery. */
export const HALF_OPEN_PROBE = 0.1;

/** Fraction of calls a node's circuit breaker admits right now (rest fail fast). */
export function breakerAdmit(runtime: NodeRuntime): number {
  switch (runtime.breaker) {
    case 'closed':
      return 1;
    case 'open':
      return 0;
    case 'halfOpen':
      return HALF_OPEN_PROBE;
  }
}

/**
 * Advances a node's breaker after a tick. `failure` is the fraction of calls
 * into the node that failed end to end.
 */
export function updateBreaker(
  node: DesignNode,
  runtime: NodeRuntime,
  failure: number,
  hadTraffic: boolean,
  nowMs: number,
): void {
  const cb = node.config.circuitBreaker;
  if (!cb.enabled) {
    runtime.breaker = 'closed';
    return;
  }
  const tripped = hadTraffic && failure > cb.errorThreshold;
  if (runtime.breaker === 'open') {
    if (nowMs >= runtime.breakerUntilMs) runtime.breaker = 'halfOpen';
  } else if (runtime.breaker === 'halfOpen') {
    if (!hadTraffic) return;
    runtime.breaker = tripped ? 'open' : 'closed';
    if (tripped) runtime.breakerUntilMs = nowMs + cb.openMs;
  } else if (tripped) {
    runtime.breaker = 'open';
    runtime.breakerUntilMs = nowMs + cb.openMs;
  }
}

export interface RetryPlan {
  /** Extra attempts per first attempt. */
  extra: number;
  /** Probability the call succeeds after its retries. */
  success: number;
  /** Mean backoff delay added per call (ms). */
  delayMs: number;
  /** Fraction of desired retries the budget allows. */
  allowed: number;
}

/**
 * Expected retry behaviour for calls with per-attempt success `s`.
 * A retry budget caps extra attempts at `budget` x first attempts; backoff
 * waits base x 2^(k-1) with full jitter (mean half of that) before retry k.
 */
export function retryPlan(
  s: number,
  retries: number,
  budget: number,
  backoffMs: number,
): RetryPlan {
  const f = 1 - s;
  const full = retryFactor(f, retries);
  const allowed = budget > 0 && full > budget ? budget / full : 1;
  let delay = 0;
  let reach = 1;
  for (let k = 1; k <= retries; k++) {
    reach *= f;
    delay += reach * ((backoffMs * Math.pow(2, k - 1)) / 2);
  }
  return {
    extra: allowed * full,
    success: s + allowed * (successWithRetries(s, retries) - s),
    delayMs: allowed * delay,
    allowed,
  };
}
