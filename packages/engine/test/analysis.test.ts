import { describe, expect, it } from 'vitest';
import {
  HOURS_PER_MONTH,
  createDesign,
  createEdge,
  createGoalTracker,
  createNode,
  createSimulation,
  diagnose,
  estimateCost,
  planCapacity,
} from '../src';
import { singleService, threeTier } from './helpers';

describe('cost model', () => {
  it('prices instances per hour and requests per million', () => {
    const design = createDesign(
      'c',
      [
        createNode('client', 'client'),
        createNode('svc', 'service', undefined, { instances: 4, costPerHour: 0.1 }),
        createNode('db', 'database', undefined, {
          instances: 1,
          replicas: 2,
          shards: 2,
          costPerHour: 0.5,
        }),
        createNode('api', 'externalApi', undefined, { costPerMillion: 2 }),
      ],
      [createEdge('client', 'svc'), createEdge('svc', 'db'), createEdge('svc', 'api')],
    );
    const fixed = estimateCost(design);
    // 4 x $0.10 + (1 + 2) x 2 shards x $0.50, per hour
    expect(fixed.fixedMonthly).toBeCloseTo((0.4 + 3) * HOURS_PER_MONTH);
    expect(fixed.usageMonthly).toBe(0);
    const tick = createSimulation(design).run(10);
    const live = estimateCost(design, tick);
    const apiRps = tick.nodes.api?.servedRps ?? 0;
    expect(live.nodes.find((n) => n.nodeId === 'api')?.usageMonthly).toBeCloseTo(
      (apiRps * 3600 * HOURS_PER_MONTH * 2) / 1e6,
    );
  });

  it('can be part of a scenario goal', () => {
    const design = singleService({ costPerHour: 1 }, { peakRps: 500 });
    const goal = {
      targetRps: 500,
      maxP99Ms: 50,
      maxErrorRate: 0.01,
      holdSeconds: 1,
      maxMonthlyCost: 100,
    };
    const tracker = createGoalTracker(goal, (t) => estimateCost(design, t).totalMonthly);
    const sim = createSimulation(design);
    let status = tracker.status();
    for (let i = 0; i < 40; i++) status = tracker.observe(sim.step());
    expect(status.state).toBe('fail');
    expect(status.checks.find((c) => c.label.startsWith('Monthly'))?.ok).toBe(false);
  });
});

describe('diagnose', () => {
  it('explains an overloaded database with concrete fixes', () => {
    const design = threeTier(
      { db: { capacityRps: 1_000, maxConcurrency: 1_000, maxQueue: 100 } },
      { peakRps: 4_000, readRatio: 0.9 },
    );
    const tick = createSimulation(design).run(30);
    const insights = diagnose(design, tick);
    const db = insights.find((i) => i.id === 'db:overload');
    expect(db?.severity).toBe('critical');
    expect(insights[0]?.severity).toBe('critical');
    expect(db?.suggestions.join(' ')).toMatch(/read replica/);
    expect(db?.suggestions.join(' ')).toMatch(/cache in front/);
  });

  it('flags retry storms and concurrency-limited services', () => {
    const design = threeTier({
      lb: { retries: 3 },
      svc: { capacityRps: 5_000, maxConcurrency: 5, baseLatencyMs: 20, instances: 1 },
    });
    const tick = createSimulation(design).run(40);
    const text = diagnose(design, tick)
      .flatMap((i) => [i.title, ...i.suggestions])
      .join('\n');
    expect(text).toMatch(/Retry storm/);
    expect(text).toMatch(/limited by its pool/);
  });

  it('reports headroom when healthy', () => {
    const design = threeTier();
    const insights = diagnose(design, createSimulation(design).run(20));
    expect(insights.at(-1)?.severity).toBe('ok');
    expect(insights.at(-1)?.detail).toMatch(/headroom/);
  });
});

describe('planCapacity', () => {
  const goal = { targetRps: 20_000, maxP99Ms: 150, maxErrorRate: 0.001, holdSeconds: 5 };

  it('scales bottlenecks until the goal is met, then trims', () => {
    const design = threeTier(
      {
        svc: { capacityRps: 2_000, instances: 2, maxConcurrency: 1_000 },
        db: { capacityRps: 50_000 },
      },
      { peakRps: 1_000, readRatio: 0.9 },
    );
    const result = planCapacity(design, goal, { seconds: 10 });
    expect(result.status).toBe('met');
    expect(result.after.pass).toBe(true);
    const svc = result.changes.find((c) => c.nodeId === 'svc');
    expect(svc?.field).toBe('instances');
    // 20k req/s at 2k per instance needs at least 10 instances, and trimming keeps it lean.
    expect(svc?.to).toBeGreaterThanOrEqual(11);
    expect(svc?.to).toBeLessThanOrEqual(20);
  });

  it('adds read replicas for read-heavy database load', () => {
    const design = threeTier(
      { svc: { capacityRps: 1e5 }, db: { capacityRps: 5_000, maxConcurrency: 5_000 } },
      { readRatio: 0.95 },
    );
    const result = planCapacity(design, goal, { seconds: 10 });
    expect(result.status).toBe('met');
    expect(result.changes.some((c) => c.nodeId === 'db' && c.field === 'replicas')).toBe(true);
  });

  it('reports when the goal is latency-bound rather than capacity-bound', () => {
    const design = threeTier({
      db: { baseLatencyMs: 400, latencySigma: 0, capacityRps: 1e6, maxConcurrency: 1e6 },
    });
    const result = planCapacity(design, { ...goal, targetRps: 1_000 }, { seconds: 6 });
    expect(result.status).toBe('unreachable');
    expect(result.message).toMatch(/more capacity will not help/);
  });

  it('leaves a passing design alone', () => {
    const result = planCapacity(threeTier(), { ...goal, targetRps: 500 }, { seconds: 6 });
    expect(result.status).toBe('already-met');
    expect(result.changes).toEqual([]);
  });
});
