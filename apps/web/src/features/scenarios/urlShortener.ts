import { createDesign, createEdge, createNode } from '@syssim/engine';
import { insertBetween, solved, tune } from './edit';
import type { Scenario } from './types';

export const urlShortener: Scenario = {
  id: 'url-shortener',
  name: 'URL shortener',
  difficulty: 'warm-up',
  summary:
    'A read-heavy redirect service (99% reads). Short codes are hot and cacheable; ' +
    'writes create new links.',
  goal: { targetRps: 1_000_000, maxP99Ms: 200, maxErrorRate: 0.001, holdSeconds: 10 },
  hints: [
    'Redirect lookups are read-mostly: put a cache in front of the database.',
    'Add read replicas so cache misses do not overwhelm the primary.',
    'Scale the API tier: each instance tops out around 5k req/s.',
  ],
  build: () =>
    createDesign(
      'URL shortener',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 2_000 }, 'Users'),
        createNode(
          'lb',
          'loadBalancer',
          { x: 230, y: 160 },
          { capacityRps: 500_000, instances: 4 },
          'Edge LB',
        ),
        createNode(
          'api',
          'service',
          { x: 460, y: 160 },
          { capacityRps: 5_000, instances: 40, baseLatencyMs: 8, timeoutMs: 1_000 },
          'Redirect API',
        ),
        createNode(
          'db',
          'database',
          { x: 720, y: 160 },
          { capacityRps: 20_000, maxConcurrency: 500, baseLatencyMs: 4, maxQueue: 5_000 },
          'Links DB',
        ),
      ],
      [createEdge('client', 'lb'), createEdge('lb', 'api'), createEdge('api', 'db')],
      { peakRps: 1_000_000, profile: 'steady', readRatio: 0.99 },
    ),
  solution() {
    const d = this.build();
    tune(d, 'api', { instances: 300 });
    tune(d, 'db', { replicas: 5 });
    insertBetween(
      d,
      'api',
      'db',
      createNode(
        'cache',
        'cache',
        { x: 590, y: 40 },
        { hitRatio: 0.95, instances: 20 },
        'Link cache',
      ),
    );
    return solved(d);
  },
};
