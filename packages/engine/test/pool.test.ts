import { describe, expect, it } from 'vitest';
import { createPoolState, stepPool } from '../src/sim/pool';

const base = { capacityRps: 100, servers: 10, maxQueue: 1_000, dtS: 0.1 };

describe('stepPool', () => {
  it('serves everything below capacity with no backlog', () => {
    const state = createPoolState();
    const r = stepPool(state, { ...base, readRps: 60, writeRps: 20 });
    expect(r.processedRead).toBeCloseTo(60);
    expect(r.processedWrite).toBeCloseTo(20);
    expect(r.backlog).toBe(0);
    expect(r.utilization).toBeCloseTo(0.8);
  });

  it('builds a backlog when inflow exceeds capacity', () => {
    const state = createPoolState();
    let r = stepPool(state, { ...base, readRps: 150, writeRps: 0 });
    expect(r.processedRead).toBeCloseTo(100);
    expect(r.backlog).toBeCloseTo(5);
    for (let i = 0; i < 9; i++) r = stepPool(state, { ...base, readRps: 150, writeRps: 0 });
    expect(r.backlog).toBeCloseTo(50);
    expect(r.saturation).toBeCloseTo(1.5);
    // Draining 50 queued requests at 100 req/s takes 500 ms.
    expect(r.waitMs).toBeGreaterThanOrEqual(500);
  });

  it('drops requests once the backlog exceeds maxQueue', () => {
    const state = createPoolState();
    let r = stepPool(state, { ...base, maxQueue: 10, readRps: 300, writeRps: 0 });
    // 30 arrive, 10 served, 20 left, 10 over the limit
    expect(r.droppedRead).toBeCloseTo(100);
    expect(r.backlog).toBeCloseTo(10);
    r = stepPool(state, { ...base, maxQueue: 10, readRps: 300, writeRps: 0 });
    expect(r.backlog).toBeCloseTo(10);
    expect(r.droppedRead).toBeCloseTo(200);
  });

  it('shares capacity between reads and writes in proportion to demand', () => {
    const state = createPoolState();
    const r = stepPool(state, { ...base, maxQueue: 0, readRps: 300, writeRps: 100 });
    expect(r.processedRead).toBeCloseTo(75);
    expect(r.processedWrite).toBeCloseTo(25);
    expect(r.droppedRead).toBeCloseTo(225);
    expect(r.droppedWrite).toBeCloseTo(75);
  });

  it('stalls with zero capacity', () => {
    const state = createPoolState();
    const r = stepPool(state, { ...base, capacityRps: 0, readRps: 10, writeRps: 0 });
    expect(r.processedRead).toBe(0);
    expect(r.waitMs).toBeGreaterThan(1e6);
  });
});
