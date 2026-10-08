import { describe, expect, it } from 'vitest';
import type { ChartPoint } from '../src/features/simulation/protocol';
import { summarizeRun, toRunPoints } from '../src/state/runsStore';

const point = (t: number, p99: number, errorRate = 0): ChartPoint => ({
  t,
  offered: 100,
  throughput: 100 * (1 - errorRate),
  errorRate,
  p50: p99 / 2,
  p95: p99 * 0.8,
  p99,
  util: {},
  nodes: {},
});

describe('saved runs', () => {
  it('aligns runs to start at t = 0', () => {
    const points = toRunPoints([point(42, 10), point(43, 20)]);
    expect(points.map((p) => p.t)).toEqual([0, 1]);
  });

  it('summarises the steady-state tail of a run', () => {
    const history = Array.from({ length: 10 }, (_, i) =>
      point(i, i < 7 ? 500 : 100, i < 7 ? 0.5 : 0),
    );
    const summary = summarizeRun(toRunPoints(history));
    expect(summary.p99).toBe(100);
    expect(summary.errorRate).toBe(0);
    expect(summary.durationS).toBe(9);
  });
});
