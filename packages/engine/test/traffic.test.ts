import { describe, expect, it } from 'vitest';
import {
  MAX_RPS,
  TRAFFIC_PROFILES,
  offeredRps,
  profileMultiplier,
  rpsToSlider,
  sliderToRps,
} from '../src';

describe('log-scale slider', () => {
  it('spans 1 to 100M req/s', () => {
    expect(sliderToRps(0)).toBe(1);
    expect(sliderToRps(1)).toBe(MAX_RPS);
    expect(sliderToRps(0.5)).toBe(10_000);
  });

  it('round-trips', () => {
    for (const rps of [1, 42, 1_000, 2_500_000, 1e8]) {
      expect(sliderToRps(rpsToSlider(rps))).toBeCloseTo(rps, -1);
    }
  });
});

describe('traffic profiles', () => {
  it('peak at exactly 1 and never exceed it', () => {
    for (const profile of TRAFFIC_PROFILES) {
      let max = 0;
      for (let t = 0; t < 300; t += 0.1) {
        const m = profileMultiplier(profile, t);
        expect(m).toBeGreaterThan(0);
        expect(m).toBeLessThanOrEqual(1 + 1e-9);
        max = Math.max(max, m);
      }
      expect(max).toBeCloseTo(1, 3);
    }
  });

  it('flash spike jumps from baseline to peak', () => {
    expect(profileMultiplier('flashSpike', 5)).toBeCloseTo(0.1);
    expect(profileMultiplier('flashSpike', 12)).toBe(1);
  });

  it('ramp grows linearly then holds', () => {
    expect(profileMultiplier('ramp', 30)).toBeCloseTo(0.5);
    expect(profileMultiplier('ramp', 120)).toBe(1);
  });

  it('scales by peak load', () => {
    expect(offeredRps({ peakRps: 2_000, profile: 'steady', readRatio: 0.5 }, 3)).toBe(2_000);
  });
});
