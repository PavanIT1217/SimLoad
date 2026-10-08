import { describe, expect, it } from 'vitest';
import { DesignError, createDesign, createEdge, createNode, createSimulation } from '../src';
import { singleService, threeTier } from './helpers';

describe('flow layer: steady state', () => {
  it('serves all traffic below capacity with near-base latency', () => {
    const sim = createSimulation(singleService({}, { peakRps: 500 }));
    const r = sim.run(50);
    expect(r.offeredRps).toBe(500);
    expect(r.throughputRps).toBeCloseTo(500, 6);
    expect(r.errorRate).toBeCloseTo(0, 9);
    expect(r.nodes.svc?.utilization).toBeCloseTo(0.5);
    // M/M/c with 10k slots at 50% load adds no measurable queueing.
    expect(r.latency.p50).toBeCloseTo(10, 1);
    expect(r.latency.p99).toBeCloseTo(10, 1);
  });

  it('adds M/M/c queueing delay as utilisation rises', () => {
    const light = createSimulation(singleService({ maxConcurrency: 1 }, { peakRps: 10 })).run(20);
    const heavy = createSimulation(singleService({ maxConcurrency: 1 }, { peakRps: 90 })).run(20);
    expect(heavy.nodes.svc?.latencyMs ?? 0).toBeGreaterThan((light.nodes.svc?.latencyMs ?? 0) * 3);
  });

  it("limits capacity by the concurrency pool (Little's Law)", () => {
    // 5 slots at 10 ms each can serve at most 500 req/s, even though capacityRps is 1000.
    const r = createSimulation(singleService({ maxConcurrency: 5 }, { peakRps: 400 })).run(10);
    expect(r.nodes.svc?.capacityRps).toBeCloseTo(500);
  });
});

describe('flow layer: overload', () => {
  it('builds a backlog and rising latency when inflow exceeds capacity', () => {
    const sim = createSimulation(singleService({ maxQueue: 1e9 }, { peakRps: 1_500 }));
    const early = sim.run(10);
    const late = sim.run(40);
    expect(late.nodes.svc?.queueDepth ?? 0).toBeGreaterThan(early.nodes.svc?.queueDepth ?? 0);
    expect(late.nodes.svc?.queueDepth).toBeCloseTo(500 * 5, -1);
    expect(late.latency.p50).toBeGreaterThan(early.latency.p50);
    expect(late.nodes.svc?.servedRps).toBeCloseTo(1_000);
  });

  it('drops requests beyond maxQueue and reports them as errors', () => {
    const sim = createSimulation(singleService({ maxQueue: 100 }, { peakRps: 2_000 }));
    const r = sim.run(50);
    expect(r.nodes.svc?.droppedRps).toBeCloseTo(1_000, 0);
    expect(r.throughputRps).toBeCloseTo(1_000, 0);
    expect(r.errorRate).toBeCloseTo(0.5, 2);
    expect(r.sampledErrorRate).toBeGreaterThan(0.3);
  });

  it('turns requests waiting longer than timeoutMs into errors', () => {
    const sim = createSimulation(
      singleService({ maxQueue: 1e9, timeoutMs: 200 }, { peakRps: 1_200 }),
    );
    const early = sim.run(5);
    expect(early.errorRate).toBeLessThan(0.05);
    // After 3 s the backlog is 600 requests = 600 ms of waiting, past the 200 ms timeout.
    const late = sim.run(25);
    expect(late.nodes.svc?.timeoutRate).toBeGreaterThan(0.99);
    expect(late.errorRate).toBeGreaterThan(0.99);
    expect(late.latency.p50).toBeCloseTo(200, 0);
  });
});

describe('retries', () => {
  it('amplify traffic by the expected number of attempts', () => {
    const design = threeTier({ lb: { retries: 3 } }, { peakRps: 1_000 });
    const sim = createSimulation(design);
    sim.injectFault('svc', { kind: 'errorRate', rate: 0.5 });
    const r = sim.run(20);
    // 1 + 0.5 + 0.25 + 0.125 attempts per request
    expect(r.nodes.svc?.inflowRps).toBeCloseTo(1_875, 0);
    expect(r.retryRps).toBeCloseTo(875, 0);
    // Success with retries: 1 - 0.5^4
    expect(r.errorRate).toBeCloseTo(0.0625, 3);
  });

  it('turn an overload into a retry storm that amplifies load', () => {
    const calm = threeTier(
      { svc: { retries: 0 }, db: { capacityRps: 1_000, maxQueue: 1e9, timeoutMs: 100 } },
      { peakRps: 1_100 },
    );
    const stormy = threeTier(
      { svc: { retries: 3 }, db: { capacityRps: 1_000, maxQueue: 1e9, timeoutMs: 100 } },
      { peakRps: 1_100 },
    );
    const a = createSimulation(calm).run(100);
    const b = createSimulation(stormy).run(100);
    expect(a.nodes.db?.inflowRps).toBeCloseTo(1_100, 0);
    expect(b.nodes.db?.inflowRps ?? 0).toBeGreaterThan(3_000);
    expect(b.nodes.db?.queueDepth ?? 0).toBeGreaterThan(a.nodes.db?.queueDepth ?? 0);
  });
});

describe('cache routing', () => {
  const cached = (readRatio: number) =>
    createDesign(
      'cached',
      [
        createNode('client', 'client', undefined, { timeoutMs: 0 }),
        createNode('cache', 'cache', undefined, { hitRatio: 0.8, timeoutMs: 0 }),
        createNode('db', 'database', undefined, { capacityRps: 100_000, timeoutMs: 0 }),
      ],
      [createEdge('client', 'cache'), createEdge('cache', 'db')],
      { peakRps: 10_000, readRatio },
    );

  it('serves hits locally and forwards only misses', () => {
    const r = createSimulation(cached(1)).run(10);
    expect(r.nodes.db?.inflowRps).toBeCloseTo(2_000, 6);
  });

  it('always forwards writes', () => {
    const r = createSimulation(cached(0.5)).run(10);
    expect(r.nodes.db?.readRps).toBeCloseTo(1_000, 6);
    expect(r.nodes.db?.writeRps).toBeCloseTo(5_000, 6);
  });

  it('sends all reads downstream right after a flush, then warms up', () => {
    const sim = createSimulation(cached(1));
    sim.run(10);
    sim.injectFault('cache', { kind: 'flushCache' });
    const cold = sim.step();
    expect(cold.nodes.db?.inflowRps ?? 0).toBeGreaterThan(9_000);
    const warm = sim.run(300);
    expect(warm.nodes.db?.inflowRps).toBeCloseTo(2_000, 0);
  });

  it('records cache hits in sampled traces', () => {
    const r = createSimulation(cached(1)).run(5);
    const outcomes = r.traces.flatMap((t) => t.spans.map((s) => s.outcome));
    expect(outcomes).toContain('hit');
  });
});

describe('read/write split', () => {
  const db = (replicas: number, readRatio: number) =>
    threeTier(
      { db: { capacityRps: 1_000, maxConcurrency: 1_000, maxQueue: 10, replicas } },
      { peakRps: 3_000, readRatio },
    );

  it('routes reads to replicas so the primary only sees writes', () => {
    const without = createSimulation(db(0, 0.9)).run(30);
    const withReplicas = createSimulation(db(3, 0.9)).run(30);
    expect(without.errorRate).toBeGreaterThan(0.5);
    expect(withReplicas.errorRate).toBeLessThan(0.001);
    expect(withReplicas.nodes.db?.capacityRps).toBeCloseTo(4_000);
  });

  it('fails only writes when the primary is overloaded', () => {
    const r = createSimulation(db(3, 0.5)).run(30);
    // 1500 writes/s against a 1000 req/s primary
    expect(r.errorRate).toBeCloseTo(500 / 3_000, 2);
    const failed = r.traces.filter((t) => !t.ok);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((t) => t.cls === 'write')).toBe(true);
  });
});

describe('faults', () => {
  it('a killed node fails every request routed through it', () => {
    const sim = createSimulation(threeTier());
    sim.run(5);
    sim.injectFault('db', { kind: 'kill' });
    const r = sim.run(5);
    expect(r.errorRate).toBeCloseTo(1, 6);
    expect(r.nodes.db?.failed).toBe(true);
    sim.clearFault('db');
    expect(sim.run(5).errorRate).toBeCloseTo(0, 6);
  });

  it('injected latency raises end-to-end latency and expires after its duration', () => {
    const sim = createSimulation(threeTier());
    const before = sim.run(20).latency.p50;
    sim.injectFault('svc', { kind: 'latency', addMs: 300 }, 2_000);
    const during = sim.run(15).latency.p50;
    expect(during - before).toBeGreaterThan(250);
    const after = sim.run(30).latency.p50;
    expect(after).toBeCloseTo(before, -1);
  });
});

describe('queue', () => {
  it('decouples producers from slow consumers', () => {
    const design = createDesign(
      'queue',
      [
        createNode('client', 'client', undefined, { timeoutMs: 0 }),
        createNode('q', 'queue', undefined, { consumerRps: 500, maxQueue: 1e9, timeoutMs: 0 }),
        createNode('worker', 'service', undefined, { capacityRps: 10_000, timeoutMs: 0 }),
      ],
      [createEdge('client', 'q'), createEdge('q', 'worker')],
      { peakRps: 1_000, readRatio: 0 },
    );
    const r = createSimulation(design).run(50);
    expect(r.errorRate).toBeCloseTo(0, 9);
    expect(r.nodes.worker?.inflowRps).toBeCloseTo(500);
    expect(r.nodes.q?.queueDepth).toBeCloseTo(2_500, -1);
    expect(r.latency.p99).toBeLessThan(20);
  });
});

describe('autoscale', () => {
  it('adds instances after the configured delay', () => {
    const design = singleService(
      {
        capacityRps: 100,
        maxQueue: 100,
        autoscale: {
          enabled: true,
          delayMs: 2_000,
          minInstances: 1,
          maxInstances: 20,
          targetUtilization: 0.5,
        },
      },
      { peakRps: 400 },
    );
    const sim = createSimulation(design);
    expect(sim.run(10).nodes.svc?.instances).toBe(1);
    const scaled = sim.run(20);
    expect(scaled.nodes.svc?.instances).toBe(8);
    expect(sim.run(10).errorRate).toBeCloseTo(0, 6);
  });
});

describe('earth scale', () => {
  it('handles 100M req/s without numerical trouble', () => {
    const design = threeTier(
      {
        lb: { capacityRps: 1e6, instances: 200 },
        svc: { capacityRps: 1e5, instances: 2_000, maxConcurrency: 10_000 },
        db: { capacityRps: 1e6, instances: 1, replicas: 199 },
      },
      { peakRps: 1e8 },
    );
    const r = createSimulation(design).run(20);
    expect(Number.isFinite(r.latency.p99)).toBe(true);
    expect(r.throughputRps).toBeCloseTo(1e8, -3);
  });
});

describe('design errors', () => {
  it('refuses to simulate an invalid design', () => {
    const design = createDesign('empty', [createNode('svc', 'service')], []);
    expect(() => createSimulation(design)).toThrow(DesignError);
  });
});
