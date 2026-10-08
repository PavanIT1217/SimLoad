import { createDesign, createEdge, createNode } from '@syssim/engine';
import { addNode, connect, moveTo, removeEdge, solved, tune } from './edit';
import type { Scenario } from './types';

export const chatSystem: Scenario = {
  id: 'chat-system',
  name: 'Chat system',
  difficulty: 'intermediate',
  summary:
    'Half the traffic sends messages, half fetches recent history. One database takes both, ' +
    'and writes alone exceed what a single primary can do.',
  goal: { targetRps: 200_000, maxP99Ms: 150, maxErrorRate: 0.001, holdSeconds: 10 },
  hints: [
    'Reads and writes have different needs: split them (select an edge → Carries).',
    'Recent messages are hot: serve history reads from a cache.',
    'Absorb message writes with a queue so senders get a fast acknowledgement.',
    'Writes still need a home: shard the message store so the consumers can keep up.',
  ],
  build: () =>
    createDesign(
      'Chat system',
      [
        createNode('client', 'client', { x: 0, y: 160 }, { timeoutMs: 2_000 }, 'Chat clients'),
        createNode(
          'gw',
          'loadBalancer',
          { x: 230, y: 160 },
          { capacityRps: 300_000, instances: 2 },
          'Gateway',
        ),
        createNode(
          'chat',
          'service',
          { x: 460, y: 160 },
          { capacityRps: 5_000, instances: 30, baseLatencyMs: 15, maxConcurrency: 200 },
          'Chat service',
        ),
        createNode(
          'db',
          'database',
          { x: 720, y: 160 },
          { capacityRps: 20_000, maxConcurrency: 1_000, baseLatencyMs: 5, maxQueue: 5_000 },
          'Message store',
        ),
      ],
      [createEdge('client', 'gw'), createEdge('gw', 'chat'), createEdge('chat', 'db')],
      { peakRps: 200_000, profile: 'steady', readRatio: 0.5 },
    ),
  solution() {
    const d = this.build();
    tune(d, 'chat', { instances: 60 });
    tune(d, 'db', { shards: 8, replicas: 1 });
    removeEdge(d, 'chat', 'db');
    addNode(
      d,
      createNode(
        'cache',
        'cache',
        { x: 720, y: 40 },
        { hitRatio: 0.9, instances: 4 },
        'Recent messages',
      ),
    );
    addNode(
      d,
      createNode(
        'mq',
        'queue',
        { x: 720, y: 290 },
        { consumerRps: 110_000, maxQueue: 10_000_000 },
        'Message log',
      ),
    );
    connect(d, 'chat', 'cache', 'read');
    connect(d, 'chat', 'mq', 'write');
    connect(d, 'cache', 'db');
    connect(d, 'mq', 'db');
    moveTo(d, 'db', 960, 160);
    return solved(d);
  },
};
