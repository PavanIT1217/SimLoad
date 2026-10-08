import { describe, expect, it } from 'vitest';
import { erlangC, littlesLaw, mmcWaitMs } from '../src';
import { EXACT_ERLANG_LIMIT } from '../src/sim/queueing';

describe('erlangC', () => {
  it('equals utilisation for a single server (M/M/1)', () => {
    expect(erlangC(1, 0.5)).toBeCloseTo(0.5, 10);
    expect(erlangC(1, 0.9)).toBeCloseTo(0.9, 10);
  });

  it('matches the textbook value for c=2, a=1.5', () => {
    expect(erlangC(2, 1.5)).toBeCloseTo(0.642857, 5);
  });

  it('is 0 with no load and 1 when saturated', () => {
    expect(erlangC(4, 0)).toBe(0);
    expect(erlangC(4, 4)).toBe(1);
  });
});

describe('mmcWaitMs', () => {
  it('matches the M/M/1 closed form Wq = rho / (mu - lambda)', () => {
    // mu = 100/s, lambda = 80/s -> Wq = 0.8 / 20 = 40 ms
    expect(mmcWaitMs(80, 100, 1)).toBeCloseTo(40, 6);
  });

  it('shrinks as servers increase at equal utilisation', () => {
    const one = mmcWaitMs(80, 100, 1);
    const many = mmcWaitMs(80, 100, 50);
    expect(many).toBeLessThan(one);
  });

  it('is unstable at or above capacity', () => {
    expect(mmcWaitMs(100, 100, 4)).toBe(Number.POSITIVE_INFINITY);
  });

  it('approximation stays close to exact Erlang C at the switch-over point', () => {
    const c = EXACT_ERLANG_LIMIT;
    const capacity = c * 10;
    const lambda = capacity * 0.97;
    const exact = (erlangC(c, lambda / 10) / (capacity - lambda)) * 1000;
    const approx = mmcWaitMs(lambda, (capacity * (c + 1)) / c, c + 1);
    expect(approx).toBeGreaterThan(exact * 0.5);
    expect(approx).toBeLessThan(exact * 2);
  });

  it('grows without bound as load approaches capacity', () => {
    expect(mmcWaitMs(99, 100, 1)).toBeGreaterThan(mmcWaitMs(90, 100, 1) * 5);
  });
});

describe('littlesLaw', () => {
  it('L = lambda * W', () => {
    expect(littlesLaw(200, 50)).toBeCloseTo(10);
  });
});
