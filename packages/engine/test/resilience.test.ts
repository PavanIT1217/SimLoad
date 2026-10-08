import { describe, expect, it } from 'vitest';
import { createDesign, createEdge, createNode, createSimulation, hottestShardShare } from '../src';
import { retryPlan } from '../src/sim/resilience';
import { singleService, threeTier } from './helpers';

describe('read/write routing', () => {
  const cqrs = () =>
    createDesign(
      'cqrs',
      [
        createNode('client', 'client', undefined, { timeoutMs: 0 }),
        createNode('api', 'service', undefined, { capacityRps: 1e5, timeoutMs: 0 }),
        createNode('cache', 'cache', undefined, { hitRatio: 0.9, timeoutMs: 0 }),
        createNode('q', 'queue', undefined, { consumerRps: 1e5, timeoutMs: 0 }),
        createNode('db', 'database', undefined, {
          capacityRps: 1e5,
          maxConcurrency: 1e4,
          timeoutMs: 0,
        }),
      ],
      [
        createEdge('client', 'api'),
        createEdge('api', 'cache', 1, 'read'),
        createEdge('api', 'q', 1, 'write'),
        createEdge('cache', 'db'),
        createEdge('q', 'db'),
      ],
      { peakRps: 10_000, readRatio: 0.8 },
    );

  it('sends reads and writes down different edges', () => {
    const r = createSimulation(cqrs()).run(20);
    expect(r.nodes.cache?.readRps).toBeCloseTo(8_000, 6);
    expect(r.nodes.cache?.writeRps).toBeCloseTo(0, 6);
    expect(r.nodes.q?.writeRps).toBeCloseTo(2_000, 6);
    expect(r.nodes.q?.readRps).toBeCloseTo(0, 6);
    // DB sees cache misses (10% of reads) plus drained writes.
    expect(r.nodes.db?.readRps).toBeCloseTo(800, 6);
    expect(r.nodes.db?.writeRps).toBeCloseTo(2_000, 6);
  });

  it('routes sampled requests by class too', () => {
    const r = createSimulation(cqrs()).run(5);
    for (const t of r.traces) {
      const visited = t.spans.map((s) => s.nodeId);
      if (t.cls === 'write') expect(visited).not.toContain('cache');
      else expect(visited).not.toContain('q');
    }
  });
});

describe('retry budget and backoff', () => {
  it('caps extra attempts at the budget', () => {
    const plan = retryPlan(0.5, 3, 0.2, 0);
    expect(plan.extra).toBeCloseTo(0.2, 9);
    expect(plan.success).toBeGreaterThan(0.5);
    expect(plan.success).toBeLessThan(1 - 0.5 ** 4);
  });

  it('limits amplification in the simulation', () => {
    const design = threeTier({ lb: { retries: 3, retryBudget: 0.1 } });
    const sim = createSimulation(design);
    sim.injectFault('svc', { kind: 'errorRate', rate: 0.5 });
    const r = sim.run(20);
    expect(r.nodes.svc?.inflowRps).toBeCloseTo(1_100, 0);
  });

  it('adds jittered exponential backoff to retried calls', () => {
    const plan = retryPlan(0.5, 2, 0, 100);
    // 0.5 x 50ms (first retry) + 0.25 x 100ms (second retry)
    expect(plan.delayMs).toBeCloseTo(50, 9);
    const sim = createSimulation(threeTier({ lb: { retries: 2, retryBackoffMs: 100 } }));
    sim.injectFault('svc', { kind: 'errorRate', rate: 0.5 });
    const slow = sim.run(20).latency.p99;
    const fast = (() => {
      const s = createSimulation(threeTier({ lb: { retries: 2 } }));
      s.injectFault('svc', { kind: 'errorRate', rate: 0.5 });
      return s.run(20).latency.p99;
    })();
    expect(slow).toBeGreaterThan(fast + 50);
  });
});

describe('circuit breaker', () => {
  const guarded = () =>
    threeTier({
      lb: { retries: 2 },
      svc: { circuitBreaker: { enabled: true, errorThreshold: 0.5, openMs: 2_000 } },
    });

  it('opens on failures, sheds load, then probes and closes after recovery', () => {
    const sim = createSimulation(guarded());
    sim.run(5);
    sim.injectFault('svc', { kind: 'errorRate', rate: 0.9 }, 1_000);
    const open = sim.run(5);
    expect(open.nodes.svc?.breaker).toBe('open');
    expect(open.nodes.svc?.inflowRps).toBeCloseTo(0, 6);
    expect(open.nodes.svc?.rejectedRps ?? 0).toBeGreaterThan(900);
    const outcomes = open.traces.flatMap((t) => t.spans.map((s) => s.outcome));
    expect(outcomes).toContain('rejected');
    const recovered = sim.run(40);
    expect(recovered.nodes.svc?.breaker).toBe('closed');
    expect(recovered.errorRate).toBeCloseTo(0, 6);
  });
});

describe('rate limiting', () => {
  it('sheds load above the limit instead of queueing it', () => {
    const r = createSimulation(
      singleService({ rateLimitRps: 800, maxQueue: 1e9 }, { peakRps: 1_000 }),
    ).run(30);
    expect(r.nodes.svc?.shedRps).toBeCloseTo(200, 6);
    expect(r.nodes.svc?.queueDepth).toBeCloseTo(0, 6);
    expect(r.errorRate).toBeCloseTo(0.2, 3);
  });
});

describe('sharding', () => {
  it('scales capacity with shards, limited by the hottest shard', () => {
    const cfg = (shards: number, hotKeySkew: number) =>
      ({ shards, hotKeySkew }) as Parameters<typeof hottestShardShare>[0];
    expect(hottestShardShare(cfg(4, 0))).toBeCloseTo(0.25);
    expect(hottestShardShare(cfg(4, 1))).toBeCloseTo(1);
    const capacity = (shards: number, skew: number) =>
      createSimulation(threeTier({ db: { capacityRps: 1_000, shards, hotKeySkew: skew } })).run(2)
        .nodes.db?.capacityRps;
    expect(capacity(4, 0)).toBeCloseTo(4_000);
    expect(capacity(4, 0.5)).toBeCloseTo(1_000 / 0.625);
  });
});

describe('cold starts', () => {
  it('slows requests served by newly started instances', () => {
    const design = singleService(
      {
        capacityRps: 100,
        coldStartMs: 400,
        maxQueue: 100,
        autoscale: {
          enabled: true,
          delayMs: 1_000,
          minInstances: 1,
          maxInstances: 20,
          targetUtilization: 0.5,
        },
      },
      { peakRps: 400 },
    );
    const sim = createSimulation(design);
    const scaled = sim.run(25);
    expect(scaled.nodes.svc?.coldFraction ?? 0).toBeGreaterThan(0.5);
    expect(scaled.nodes.svc?.latencyMs ?? 0).toBeGreaterThan(200);
    const warm = sim.run(150);
    expect(warm.nodes.svc?.coldFraction).toBe(0);
    expect(warm.nodes.svc?.latencyMs ?? 0).toBeLessThan(50);
  });
});

describe('load balancer health checks', () => {
  const twoRegions = () =>
    createDesign(
      'regions',
      [
        createNode('client', 'client', undefined, { timeoutMs: 0 }),
        createNode('glb', 'loadBalancer', undefined, { capacityRps: 1e6, timeoutMs: 0 }),
        createNode('east', 'service', undefined, { capacityRps: 1e4, timeoutMs: 0 }),
        createNode('west', 'service', undefined, { capacityRps: 1e4, timeoutMs: 0 }),
      ],
      [createEdge('client', 'glb'), createEdge('glb', 'east'), createEdge('glb', 'west')],
      { peakRps: 1_000 },
    );

  it('routes around a dead target', () => {
    const sim = createSimulation(twoRegions());
    sim.run(5);
    sim.injectFault('east', { kind: 'kill' });
    const r = sim.run(5);
    expect(r.nodes.west?.inflowRps).toBeCloseTo(1_000, 6);
    expect(r.errorRate).toBeCloseTo(0, 6);
  });

  it('does not reroute for plain services', () => {
    const design = twoRegions();
    design.nodes[1] = createNode('glb', 'service', undefined, { capacityRps: 1e6, timeoutMs: 0 });
    const sim = createSimulation(design);
    sim.injectFault('east', { kind: 'kill' });
    expect(sim.run(5).errorRate).toBeCloseTo(0.5, 6);
  });
});
