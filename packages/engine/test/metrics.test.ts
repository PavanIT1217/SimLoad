import { describe, expect, it } from 'vitest';
import {
  createGoalTracker,
  createRng,
  createSimulation,
  fitFromPercentiles,
  fitLognormal,
  percentile,
  summarize,
} from '../src';
import { singleService } from './helpers';

describe('percentiles', () => {
  it('interpolates between closest ranks', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBeCloseTo(5.5);
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(10);
    expect(percentile(sorted, 90)).toBeCloseTo(9.1);
  });

  it('summarises unsorted samples', () => {
    const s = summarize([5, 1, 3, 2, 4]);
    expect(s).toMatchObject({ p50: 3, mean: 3, max: 5, count: 5 });
  });

  it('handles empty input', () => {
    expect(summarize([]).count).toBe(0);
    expect(percentile([], 99)).toBe(0);
  });
});

describe('calibration', () => {
  it('derives sigma from p50 and p99', () => {
    const fit = fitFromPercentiles(20, 80);
    expect(fit.medianMs).toBe(20);
    expect(fit.sigma).toBeCloseTo(Math.log(4) / 2.3263, 3);
  });

  it('recovers lognormal parameters from samples', () => {
    const rng = createRng(11);
    const samples = Array.from({ length: 20_000 }, () => rng.lognormal(35, 0.4));
    const fit = fitLognormal(samples);
    expect(fit.medianMs).toBeCloseTo(35, 0);
    expect(fit.sigma).toBeCloseTo(0.4, 1);
  });

  it('rejects unusable input', () => {
    expect(() => fitFromPercentiles(50, 10)).toThrow(RangeError);
    expect(() => fitLognormal([1])).toThrow(RangeError);
  });
});

describe('goal tracker', () => {
  const goal = { targetRps: 500, maxP99Ms: 50, maxErrorRate: 0.001, holdSeconds: 2 };

  it('passes a design that meets the goal', () => {
    const sim = createSimulation(singleService({}, { peakRps: 500 }));
    const tracker = createGoalTracker(goal);
    let status = tracker.observe(sim.step());
    expect(status.state).toBe('pending');
    for (let i = 0; i < 40; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('pass');
  });

  it('fails a design that is overloaded', () => {
    const sim = createSimulation(singleService({ capacityRps: 300 }, { peakRps: 500 }));
    const tracker = createGoalTracker(goal);
    let status = tracker.status();
    for (let i = 0; i < 40; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('fail');
    expect(status.checks.some((c) => !c.ok)).toBe(true);
  });

  it('stays pending below the target load', () => {
    const sim = createSimulation(singleService({}, { peakRps: 100 }));
    const tracker = createGoalTracker(goal);
    let status = tracker.status();
    for (let i = 0; i < 40; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('pending');
    expect(status.progress).toBe(0);
  });
});

describe('latched goal tracker', () => {
  it('keeps the first verdict until reset', () => {
    const goal = { targetRps: 500, maxP99Ms: 50, maxErrorRate: 0.001, holdSeconds: 1 };
    const sim = createSimulation(singleService({}, { peakRps: 500 }));
    const tracker = createGoalTracker(goal, undefined, { latch: true });
    sim.injectFault('svc', { kind: 'kill' });
    let status = tracker.status();
    for (let i = 0; i < 30; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('fail');
    sim.clearFault('svc');
    for (let i = 0; i < 60; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('fail');
    tracker.reset();
    for (let i = 0; i < 60; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('pass');
  });
});
