import { createDesign, createEdge, createNode } from '@simload/engine';
import { addNode, connect, removeEdge, solved, tune } from './edit';
import type { Scenario } from './types';

export const payments: Scenario = {
  id: 'payments',
  name: 'Payment processing',
  difficulty: 'advanced',
  summary:
    'Every request goes to a slow third-party payment provider, including status checks that ' +
    'could be answered locally. The provider limits concurrent calls, and aggressive retries ' +
    'turn every slowdown into an outage.',
  goal: { targetRps: 5_000, maxP99Ms: 1_500, maxErrorRate: 0.005, holdSeconds: 10 },
  hints: [
    'Only charges (writes) need the provider. Status checks (reads) can come from your own ledger.',
    'Route reads and writes separately: select an edge and set what it carries.',
    'Buy more provider concurrency, and make retries safe: idempotency keys, a retry budget and backoff.',
  ],
  build: () =>
    createDesign(
      'Payment processing',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 5_000 }, 'Checkout'),
        createNode('lb', 'loadBalancer', { x: 230, y: 160 }, { capacityRps: 50_000 }, 'API LB'),
        createNode(
          'pay',
          'service',
          { x: 460, y: 160 },
          { capacityRps: 1_000, instances: 10, baseLatencyMs: 10, retries: 3, timeoutMs: 3_000 },
          'Payments service',
        ),
        createNode(
          'psp',
          'externalApi',
          { x: 720, y: 160 },
          {
            capacityRps: 500,
            instances: 5,
            baseLatencyMs: 300,
            latencySigma: 0.4,
            maxConcurrency: 100,
            timeoutMs: 2_000,
          },
          'Payment provider',
        ),
      ],
      [createEdge('client', 'lb'), createEdge('lb', 'pay'), createEdge('pay', 'psp')],
      { peakRps: 5_000, profile: 'steady', readRatio: 0.6 },
    ),
  solution() {
    const d = this.build();
    removeEdge(d, 'pay', 'psp');
    addNode(
      d,
      createNode(
        'ledger',
        'database',
        { x: 720, y: 40 },
        { capacityRps: 10_000, maxConcurrency: 1_000, replicas: 1 },
        'Ledger',
      ),
    );
    connect(d, 'pay', 'ledger', 'read');
    connect(d, 'pay', 'psp', 'write');
    tune(d, 'psp', { instances: 10 });
    tune(d, 'pay', { retries: 2, retryBudget: 0.1, retryBackoffMs: 100 });
    return solved(d);
  },
};
