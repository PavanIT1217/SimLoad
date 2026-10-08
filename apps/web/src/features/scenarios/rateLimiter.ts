import { createDesign, createEdge, createNode } from '@syssim/engine';
import { solved, tune } from './edit';
import type { Scenario } from './types';

export const rateLimiter: Scenario = {
  id: 'rate-limiter',
  name: 'API rate limiting',
  difficulty: 'intermediate',
  summary:
    'A burst of client traffic pushes the API past capacity. Queues grow, requests time out, ' +
    'clients retry, and the whole API collapses even though it is only ~10% short.',
  goal: { targetRps: 100_000, maxP99Ms: 300, maxErrorRate: 0.2, holdSeconds: 10 },
  hints: [
    'Watch what happens to latency and retries when the spike arrives: this is congestion collapse.',
    'Failing some requests fast is better than failing all of them slowly: add a rate limit at the gateway.',
    'Retries make overload worse: give clients a retry budget and backoff.',
  ],
  build: () =>
    createDesign(
      'API rate limiting',
      [
        createNode(
          'client',
          'client',
          { x: 0, y: 160 },
          { timeoutMs: 1_000, retries: 2 },
          'API clients',
        ),
        createNode(
          'gw',
          'loadBalancer',
          { x: 230, y: 160 },
          { capacityRps: 500_000, instances: 2 },
          'API gateway',
        ),
        createNode(
          'api',
          'service',
          { x: 460, y: 160 },
          {
            capacityRps: 3_000,
            instances: 30,
            baseLatencyMs: 20,
            maxConcurrency: 500,
            maxQueue: 200_000,
            timeoutMs: 800,
          },
          'Public API',
        ),
        createNode(
          'db',
          'database',
          { x: 720, y: 160 },
          { capacityRps: 200_000, maxConcurrency: 5_000, baseLatencyMs: 4, maxQueue: 50_000 },
          'API data',
        ),
      ],
      [createEdge('client', 'gw'), createEdge('gw', 'api'), createEdge('api', 'db')],
      { peakRps: 100_000, profile: 'flashSpike', readRatio: 0.8 },
    ),
  solution() {
    const d = this.build();
    tune(d, 'gw', { rateLimitRps: 85_000 });
    tune(d, 'client', { retryBudget: 0.1, retryBackoffMs: 100 });
    return solved(d);
  },
};
