import { createDesign, createEdge, createNode } from '@syssim/engine';
import type { Scenario } from './types';

export const newsFeed: Scenario = {
  id: 'news-feed',
  name: 'News feed',
  summary:
    'A social feed under a daily traffic wave. Feeds are assembled from a timeline cache, ' +
    'with a slow ranking API on the critical path.',
  goal: { targetRps: 200_000, maxP99Ms: 300, maxErrorRate: 0.001, holdSeconds: 5 },
  hints: [
    'The daily wave only reaches the target near its peak: watch the run around t = 60s.',
    'The ranking API is slow and small. Raise its capacity or cut its timeout and add retries.',
    'Turn on autoscaling for the feed service, but remember instances take time to boot.',
  ],
  build: () =>
    createDesign(
      'News feed',
      [
        createNode('client', 'client', { x: 0, y: 200 }, { timeoutMs: 3_000 }, 'Mobile apps'),
        createNode(
          'cdn',
          'cdn',
          { x: 220, y: 200 },
          { hitRatio: 0.3, capacityRps: 200_000, instances: 20 },
          'CDN',
        ),
        createNode(
          'lb',
          'loadBalancer',
          { x: 440, y: 200 },
          { capacityRps: 200_000, instances: 2 },
          'API gateway',
        ),
        createNode(
          'feed',
          'service',
          { x: 660, y: 200 },
          { capacityRps: 3_000, instances: 30, baseLatencyMs: 25, maxConcurrency: 300 },
          'Feed service',
        ),
        createNode(
          'cache',
          'cache',
          { x: 900, y: 80 },
          { hitRatio: 0.85, capacityRps: 100_000, instances: 4 },
          'Timeline cache',
        ),
        createNode(
          'db',
          'database',
          { x: 1140, y: 80 },
          { capacityRps: 15_000, replicas: 2, maxConcurrency: 400, baseLatencyMs: 8 },
          'Posts DB',
        ),
        createNode(
          'rank',
          'externalApi',
          { x: 900, y: 320 },
          { capacityRps: 2_000, instances: 10, baseLatencyMs: 60, maxConcurrency: 200 },
          'Ranking API',
        ),
      ],
      [
        createEdge('client', 'cdn'),
        createEdge('cdn', 'lb'),
        createEdge('lb', 'feed'),
        createEdge('feed', 'cache', 3),
        createEdge('feed', 'rank', 1),
        createEdge('cache', 'db'),
      ],
      { peakRps: 200_000, profile: 'dailyWave', readRatio: 0.95 },
    ),
};
