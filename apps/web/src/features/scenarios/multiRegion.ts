import { createDesign, createEdge, createNode } from '@simload/engine';
import type { DesignNode } from '@simload/engine';
import { solved, tune } from './edit';
import type { Scenario } from './types';

function region(prefix: string, zone: string, y: number): DesignNode[] {
  const nodes = [
    createNode(
      `${prefix}-lb`,
      'loadBalancer',
      { x: 460, y },
      { capacityRps: 400_000 },
      `${zone} LB`,
    ),
    createNode(
      `${prefix}-svc`,
      'service',
      { x: 690, y },
      { capacityRps: 5_000, instances: 40, baseLatencyMs: 20, maxConcurrency: 200 },
      `${zone} API`,
    ),
    createNode(
      `${prefix}-db`,
      'database',
      { x: 930, y },
      { capacityRps: 50_000, maxConcurrency: 1_000, baseLatencyMs: 5, replicas: 3 },
      `${zone} DB`,
    ),
  ];
  return nodes.map((n) => ({ ...n, zone }));
}

export const multiRegion: Scenario = {
  id: 'multi-region',
  name: 'Multi-region failover',
  difficulty: 'advanced',
  summary:
    'Two regions share the load behind a global load balancer. At t = 15 s, us-east goes dark ' +
    'for 20 s. Health checks move its traffic to us-west, and us-west has to survive the double load.',
  goal: { targetRps: 300_000, maxP99Ms: 200, maxErrorRate: 0.01, holdSeconds: 25 },
  chaos: [{ atS: 15, durationS: 20, zone: 'us-east', label: 'us-east outage' }],
  hints: [
    'Run it and watch us-west when us-east fails: failover only works if the survivor has room.',
    'N+1 at the region level: each region must carry 100% of the load on its own.',
    'Remember the database: replicas must absorb the doubled read traffic too.',
  ],
  build: () =>
    createDesign(
      'Multi-region failover',
      [
        createNode('client', 'client', { x: 0, y: 200 }, { timeoutMs: 2_000 }, 'Users worldwide'),
        createNode(
          'glb',
          'loadBalancer',
          { x: 230, y: 200 },
          { capacityRps: 1_000_000, instances: 2 },
          'Global LB',
        ),
        ...region('east', 'us-east', 80),
        ...region('west', 'us-west', 320),
      ],
      [
        createEdge('client', 'glb'),
        createEdge('glb', 'east-lb'),
        createEdge('glb', 'west-lb'),
        createEdge('east-lb', 'east-svc'),
        createEdge('east-svc', 'east-db'),
        createEdge('west-lb', 'west-svc'),
        createEdge('west-svc', 'west-db'),
      ],
      { peakRps: 300_000, profile: 'steady', readRatio: 0.9 },
    ),
  solution() {
    const d = this.build();
    for (const prefix of ['east', 'west']) {
      tune(d, `${prefix}-svc`, { instances: 72 });
      tune(d, `${prefix}-db`, { replicas: 7 });
    }
    return solved(d);
  },
};
