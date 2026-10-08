import type { Design, NodeConfig, TrafficSettings } from '../src';
import { createDesign, createEdge, createNode } from '../src';

/** client -> service, with deterministic latency unless overridden. */
export function singleService(
  service: Partial<NodeConfig> = {},
  traffic: Partial<TrafficSettings> = {},
): Design {
  return createDesign(
    'single',
    [
      createNode('client', 'client'),
      createNode('svc', 'service', undefined, {
        capacityRps: 1_000,
        instances: 1,
        baseLatencyMs: 10,
        latencySigma: 0,
        maxConcurrency: 10_000,
        maxQueue: 1_000,
        timeoutMs: 0,
        ...service,
      }),
    ],
    [createEdge('client', 'svc')],
    { peakRps: 500, readRatio: 1, ...traffic },
  );
}

/** client -> lb -> svc -> db with optional overrides per node. */
export function threeTier(
  overrides: { lb?: Partial<NodeConfig>; svc?: Partial<NodeConfig>; db?: Partial<NodeConfig> } = {},
  traffic: Partial<TrafficSettings> = {},
): Design {
  return createDesign(
    'three-tier',
    [
      createNode('client', 'client', undefined, { timeoutMs: 0 }),
      createNode('lb', 'loadBalancer', undefined, { timeoutMs: 0, ...overrides.lb }),
      createNode('svc', 'service', undefined, {
        capacityRps: 10_000,
        timeoutMs: 0,
        ...overrides.svc,
      }),
      createNode('db', 'database', undefined, {
        capacityRps: 10_000,
        maxConcurrency: 10_000,
        timeoutMs: 0,
        ...overrides.db,
      }),
    ],
    [createEdge('client', 'lb'), createEdge('lb', 'svc'), createEdge('svc', 'db')],
    { peakRps: 1_000, readRatio: 1, ...traffic },
  );
}
