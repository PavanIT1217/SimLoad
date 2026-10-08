import { describe, expect, it } from 'vitest';
import {
  CLOUD_PRICE_LISTS,
  HOURS_PER_MONTH,
  cloudPricePatches,
  compareCloudCosts,
  createDesign,
  createEdge,
  createNode,
  createSimulation,
  estimateCost,
} from '../src';
import { threeTier } from './helpers';

describe('cloud cost comparison', () => {
  it('has a price for every billable building block on every provider', () => {
    for (const list of CLOUD_PRICE_LISTS) {
      for (const kind of [
        'cdn',
        'loadBalancer',
        'service',
        'cache',
        'database',
        'queue',
      ] as const) {
        const sku = list.skus[kind];
        expect(sku, `${list.id} ${kind}`).toBeDefined();
        expect(sku?.perHour).toBeGreaterThanOrEqual(0);
        expect(sku?.perMillion).toBeGreaterThanOrEqual(0);
        expect((sku?.perHour ?? 0) + (sku?.perMillion ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it('prices the same instances on each provider', () => {
    const design = threeTier({ svc: { instances: 3 }, db: { replicas: 1 } });
    const [aws] = compareCloudCosts(design);
    const svc = aws?.nodes.find((n) => n.nodeId === 'svc');
    expect(svc?.sku).toBe('EC2 m7i.large');
    expect(svc?.monthly).toBeCloseTo(3 * 0.1008 * HOURS_PER_MONTH);
    const db = aws?.nodes.find((n) => n.nodeId === 'db');
    expect(db?.instances).toBe(2);
    expect(aws?.totalMonthly).toBeCloseTo(aws?.nodes.reduce((s, n) => s + n.monthly, 0) ?? 0);
  });

  it('charges usage on served traffic and keeps external API prices', () => {
    const design = createDesign(
      'q',
      [
        createNode('client', 'client'),
        createNode('q', 'queue', undefined, { consumerRps: 1e6 }),
        createNode('api', 'externalApi', undefined, { costPerMillion: 3 }),
      ],
      [createEdge('client', 'q'), createEdge('q', 'api')],
      { peakRps: 1_000 },
    );
    const tick = createSimulation(design).run(20);
    const costs = compareCloudCosts(design, tick);
    const served = tick.nodes.q?.servedRps ?? 0;
    expect(served).toBeGreaterThan(0);
    const sqs = costs[0]?.nodes.find((n) => n.nodeId === 'q');
    expect(sqs?.monthly).toBeCloseTo((served * 3600 * HOURS_PER_MONTH * 0.4) / 1e6);
    const apiCosts = costs.map((c) => c.nodes.find((n) => n.nodeId === 'api'));
    expect(apiCosts.every((a) => a?.sku === null)).toBe(true);
    expect(new Set(apiCosts.map((a) => a?.monthly.toFixed(6))).size).toBe(1);
  });

  it('applies a provider price list as config patches', () => {
    const design = threeTier();
    const patches = cloudPricePatches(design, 'gcp');
    expect(Object.keys(patches).sort()).toEqual(['db', 'lb', 'svc']);
    const repriced = {
      ...design,
      nodes: design.nodes.map((n) => ({ ...n, config: { ...n.config, ...patches[n.id] } })),
    };
    const gcp = compareCloudCosts(repriced).find((c) => c.provider === 'gcp');
    expect(estimateCost(repriced).totalMonthly).toBeCloseTo(gcp?.totalMonthly ?? -1);
  });
});
