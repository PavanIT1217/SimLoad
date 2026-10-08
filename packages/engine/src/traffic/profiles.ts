import type { TrafficProfile, TrafficSettings } from '../model/types';
import { clamp } from '../util/math';

export const MIN_RPS = 1;
/** "Earth scale": 100M req/s. */
export const MAX_RPS = 100_000_000;

/** Period of one simulated "day" for the daily wave profile. */
export const DAY_PERIOD_S = 120;
export const SPIKE_PERIOD_S = 60;
export const SPIKE_START_S = 10;
export const SPIKE_DURATION_S = 15;
export const SPIKE_BASELINE = 0.1;
export const RAMP_DURATION_S = 60;

export const TRAFFIC_PROFILES: readonly TrafficProfile[] = [
  'steady',
  'dailyWave',
  'flashSpike',
  'ramp',
];

export const PROFILE_LABELS: Record<TrafficProfile, string> = {
  steady: 'Steady',
  dailyWave: 'Daily wave',
  flashSpike: 'Flash spike',
  ramp: 'Ramp',
};

/**
 * Fraction (0..1] of peak load offered at simulated time `t` seconds.
 * Every profile peaks at 1, so the traffic slider always means "peak load".
 */
export function profileMultiplier(profile: TrafficProfile, t: number): number {
  switch (profile) {
    case 'steady':
      return 1;
    case 'dailyWave':
      // Starts at the overnight trough (10%) and peaks mid-"day".
      return 0.55 - 0.45 * Math.cos((2 * Math.PI * t) / DAY_PERIOD_S);
    case 'flashSpike': {
      const phase = t % SPIKE_PERIOD_S;
      const inSpike = phase >= SPIKE_START_S && phase < SPIKE_START_S + SPIKE_DURATION_S;
      return inSpike ? 1 : SPIKE_BASELINE;
    }
    case 'ramp':
      return clamp(t / RAMP_DURATION_S, 0.01, 1);
  }
}

/** Offered load in req/s at simulated time `t` seconds. */
export function offeredRps(traffic: TrafficSettings, t: number): number {
  return traffic.peakRps * profileMultiplier(traffic.profile, t);
}

/** Maps a 0..1 slider position onto 1..100M req/s on a log scale. */
export function sliderToRps(position: number): number {
  const p = clamp(position, 0, 1);
  return Math.round(MIN_RPS * Math.pow(MAX_RPS / MIN_RPS, p));
}

/** Inverse of {@link sliderToRps}. */
export function rpsToSlider(rps: number): number {
  const r = clamp(rps, MIN_RPS, MAX_RPS);
  return Math.log(r / MIN_RPS) / Math.log(MAX_RPS / MIN_RPS);
}
