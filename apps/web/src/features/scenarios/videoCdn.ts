import { createDesign, createEdge, createNode } from '@syssim/engine';
import { insertBetween, solved } from './edit';
import type { Scenario } from './types';

export const videoCdn: Scenario = {
  id: 'video-cdn',
  name: 'Video streaming CDN',
  difficulty: 'warm-up',
  summary:
    'Two million segment requests per second, almost all reads, served from a distant origin ' +
    'whose latency varies a lot.',
  goal: { targetRps: 2_000_000, maxP99Ms: 80, maxErrorRate: 0.001, holdSeconds: 10 },
  hints: [
    'Video segments are immutable: they are perfect for edge caching.',
    'p99 is decided by the slowest 1%: with a 95% hit ratio, the 5% of misses still set your p99.',
    'Push the CDN hit ratio above 99% so the slow origin path falls outside the p99.',
  ],
  build: () =>
    createDesign(
      'Video streaming CDN',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 3_000 }, 'Viewers'),
        createNode(
          'lb',
          'loadBalancer',
          { x: 230, y: 160 },
          { capacityRps: 1_000_000, instances: 4 },
          'Origin LB',
        ),
        createNode(
          'origin',
          'service',
          { x: 460, y: 160 },
          {
            capacityRps: 10_000,
            instances: 300,
            baseLatencyMs: 60,
            latencySigma: 0.5,
            maxConcurrency: 1_000,
          },
          'Origin servers',
        ),
        createNode(
          'store',
          'database',
          { x: 720, y: 160 },
          { capacityRps: 50_000, maxConcurrency: 2_000, baseLatencyMs: 8, replicas: 4 },
          'Segment store',
        ),
      ],
      [createEdge('client', 'lb'), createEdge('lb', 'origin'), createEdge('origin', 'store')],
      { peakRps: 2_000_000, profile: 'steady', readRatio: 0.999 },
    ),
  solution() {
    const d = this.build();
    insertBetween(
      d,
      'client',
      'lb',
      createNode('cdn', 'cdn', { x: 115, y: 30 }, { hitRatio: 0.995, instances: 40 }, 'Edge CDN'),
    );
    return solved(d);
  },
};
