import { createDesign, createEdge, createNode } from '@simload/engine';
import { insertBetween, solved } from './edit';
import type { Scenario } from './types';

export const flashSale: Scenario = {
  id: 'flash-sale',
  name: 'Ticket flash sale',
  difficulty: 'intermediate',
  summary:
    'Tickets go on sale and traffic spikes 10x in seconds. Most requests try to reserve a seat ' +
    '(writes), all hitting one primary database.',
  goal: { targetRps: 300_000, maxP99Ms: 500, maxErrorRate: 0.01, holdSeconds: 10 },
  hints: [
    'Writes only go to the primary: replicas will not save you here.',
    'Put a queue between the booking service and the database to absorb the spike.',
    'Retries during overload make things worse. Watch the retry traffic on the chart.',
  ],
  build: () =>
    createDesign(
      'Ticket flash sale',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 3_000 }, 'Fans'),
        createNode(
          'lb',
          'loadBalancer',
          { x: 230, y: 160 },
          { capacityRps: 400_000, instances: 2 },
          'Load balancer',
        ),
        createNode(
          'booking',
          'service',
          { x: 460, y: 160 },
          {
            capacityRps: 4_000,
            instances: 100,
            baseLatencyMs: 15,
            maxConcurrency: 200,
            retries: 2,
            autoscale: {
              enabled: true,
              delayMs: 30_000,
              minInstances: 20,
              maxInstances: 200,
              targetUtilization: 0.7,
            },
          },
          'Booking service',
        ),
        createNode(
          'db',
          'database',
          { x: 720, y: 160 },
          { capacityRps: 30_000, maxConcurrency: 1_000, baseLatencyMs: 6, replicas: 3 },
          'Inventory DB',
        ),
      ],
      [createEdge('client', 'lb'), createEdge('lb', 'booking'), createEdge('booking', 'db')],
      { peakRps: 300_000, profile: 'flashSpike', readRatio: 0.3 },
    ),
  solution() {
    const d = this.build();
    insertBetween(
      d,
      'booking',
      'db',
      createNode(
        'queue',
        'queue',
        { x: 590, y: 40 },
        { consumerRps: 30_000, maxQueue: 50_000_000 },
        'Reservation queue',
      ),
    );
    return solved(d);
  },
};
