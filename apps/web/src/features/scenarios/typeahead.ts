import { createDesign, createEdge, createNode } from '@simload/engine';
import { insertBetween, solved } from './edit';
import type { Scenario } from './types';

export const typeahead: Scenario = {
  id: 'typeahead',
  name: 'Search typeahead',
  difficulty: 'intermediate',
  summary:
    'Suggestions must appear while the user types: a tight p99 at half a million lookups per ' +
    'second, against an index with long-tail latency.',
  goal: { targetRps: 500_000, maxP99Ms: 50, maxErrorRate: 0.001, holdSeconds: 10 },
  hints: [
    'Prefixes repeat enormously: cache the top suggestions per prefix.',
    'The index has a fat tail (σ = 0.6): any request that reaches it is likely to blow the p99.',
    'Aim for a hit ratio above 99% so index lookups fall outside the slowest 1%.',
  ],
  build: () =>
    createDesign(
      'Search typeahead',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 1_000 }, 'Search box'),
        createNode('lb', 'loadBalancer', { x: 230, y: 160 }, { capacityRps: 1_000_000 }, 'Edge LB'),
        createNode(
          'svc',
          'service',
          { x: 460, y: 160 },
          { capacityRps: 10_000, instances: 80, baseLatencyMs: 5, maxConcurrency: 500 },
          'Suggest service',
        ),
        createNode(
          'index',
          'database',
          { x: 720, y: 160 },
          {
            capacityRps: 50_000,
            maxConcurrency: 2_000,
            baseLatencyMs: 20,
            latencySigma: 0.6,
            replicas: 10,
          },
          'Search index',
        ),
      ],
      [createEdge('client', 'lb'), createEdge('lb', 'svc'), createEdge('svc', 'index')],
      { peakRps: 500_000, profile: 'steady', readRatio: 1 },
    ),
  solution() {
    const d = this.build();
    insertBetween(
      d,
      'svc',
      'index',
      createNode(
        'cache',
        'cache',
        { x: 590, y: 40 },
        { hitRatio: 0.995, instances: 10 },
        'Prefix cache',
      ),
    );
    return solved(d);
  },
};
