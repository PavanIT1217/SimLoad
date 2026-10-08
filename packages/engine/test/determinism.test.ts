import { describe, expect, it } from 'vitest';
import { createRng, createSimulation } from '../src';
import { threeTier } from './helpers';

function runTrace(seed: number) {
  const sim = createSimulation(threeTier({ svc: { latencySigma: 0.8 } }), { seed });
  sim.injectFault('svc', { kind: 'errorRate', rate: 0.1 });
  return Array.from({ length: 30 }, () => sim.step());
}

describe('determinism', () => {
  it('produces identical results for the same seed and design', () => {
    expect(JSON.stringify(runTrace(7))).toEqual(JSON.stringify(runTrace(7)));
  });

  it('produces different samples for different seeds', () => {
    const a = runTrace(1).at(-1);
    const b = runTrace(2).at(-1);
    expect(a?.latency.p50).not.toEqual(b?.latency.p50);
  });

  it('reset() replays the exact same run', () => {
    const sim = createSimulation(threeTier({ svc: { latencySigma: 0.5 } }), { seed: 99 });
    const first = JSON.stringify(sim.run(25));
    sim.reset();
    expect(JSON.stringify(sim.run(25))).toEqual(first);
  });
});

describe('rng', () => {
  it('is uniform-ish and in range', () => {
    const rng = createRng(123);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });

  it('draws lognormal values around the median', () => {
    const rng = createRng(5);
    const draws = Array.from({ length: 20_000 }, () => rng.lognormal(50, 0.5)).sort(
      (a, b) => a - b,
    );
    expect(draws[10_000]).toBeGreaterThan(47);
    expect(draws[10_000]).toBeLessThan(53);
  });

  it('weightedIndex respects weights', () => {
    const rng = createRng(9);
    const counts = [0, 0];
    for (let i = 0; i < 10_000; i++) {
      const idx = rng.weightedIndex([1, 3]);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    expect((counts[1] ?? 0) / 10_000).toBeCloseTo(0.75, 1);
  });
});
