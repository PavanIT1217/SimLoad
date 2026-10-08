import type {
  ComponentKind,
  Design,
  DesignEdge,
  DesignNode,
  EdgeTraffic,
  NodeConfig,
  Position,
  SimulationOptions,
  TrafficSettings,
} from './types';

const BASE_CONFIG: NodeConfig = {
  capacityRps: 1_000,
  instances: 1,
  baseLatencyMs: 10,
  latencySigma: 0.3,
  maxConcurrency: 100,
  maxQueue: 1_000,
  timeoutMs: 1_000,
  retries: 0,
  hitRatio: 0,
  replicas: 0,
  consumerRps: 0,
  retryBackoffMs: 0,
  retryBudget: 0,
  rateLimitRps: 0,
  shards: 1,
  hotKeySkew: 0,
  coldStartMs: 0,
  costPerHour: 0,
  costPerMillion: 0,
  circuitBreaker: { enabled: false, errorThreshold: 0.5, openMs: 5_000 },
  autoscale: {
    enabled: false,
    delayMs: 30_000,
    minInstances: 1,
    maxInstances: 100,
    targetUtilization: 0.7,
  },
};

const KIND_OVERRIDES: Record<ComponentKind, Partial<NodeConfig>> = {
  client: { capacityRps: 0, baseLatencyMs: 0, latencySigma: 0, timeoutMs: 5_000, retries: 0 },
  cdn: {
    costPerMillion: 0.75,
    capacityRps: 100_000,
    instances: 50,
    baseLatencyMs: 15,
    maxConcurrency: 10_000,
    maxQueue: 100_000,
    hitRatio: 0.9,
  },
  loadBalancer: {
    costPerHour: 0.03,
    costPerMillion: 0.05,
    capacityRps: 50_000,
    instances: 2,
    baseLatencyMs: 1,
    latencySigma: 0.2,
    maxConcurrency: 10_000,
    maxQueue: 10_000,
  },
  service: {
    costPerHour: 0.1,
    capacityRps: 2_000,
    instances: 4,
    baseLatencyMs: 20,
    maxConcurrency: 200,
  },
  cache: {
    costPerHour: 0.17,
    capacityRps: 100_000,
    instances: 3,
    baseLatencyMs: 1,
    latencySigma: 0.25,
    maxConcurrency: 10_000,
    maxQueue: 10_000,
    timeoutMs: 100,
    hitRatio: 0.8,
  },
  queue: {
    costPerMillion: 0.4,
    capacityRps: 1_000_000,
    baseLatencyMs: 3,
    maxConcurrency: 100_000,
    maxQueue: 1_000_000,
    consumerRps: 5_000,
  },
  database: {
    costPerHour: 0.5,
    capacityRps: 5_000,
    baseLatencyMs: 5,
    latencySigma: 0.5,
    maxConcurrency: 200,
    maxQueue: 2_000,
    timeoutMs: 500,
    replicas: 0,
  },
  externalApi: {
    costPerMillion: 1,
    capacityRps: 500,
    baseLatencyMs: 120,
    latencySigma: 0.6,
    maxConcurrency: 100,
    maxQueue: 500,
    timeoutMs: 2_000,
  },
};

export const KIND_LABELS: Record<ComponentKind, string> = {
  client: 'Client',
  cdn: 'CDN',
  loadBalancer: 'Load Balancer',
  service: 'Service',
  cache: 'Cache',
  queue: 'Queue',
  database: 'Database',
  externalApi: 'External API',
};

export const DEFAULT_TRAFFIC: TrafficSettings = {
  peakRps: 1_000,
  profile: 'steady',
  readRatio: 0.9,
};

export const DEFAULT_OPTIONS: SimulationOptions = {
  seed: 42,
  tickMs: 100,
  samplesPerTick: 200,
  percentileWindowTicks: 10,
  maxTraces: 5,
};

/** Default configuration for a component kind (a fresh copy). */
export function defaultConfig(kind: ComponentKind): NodeConfig {
  const base: NodeConfig = { ...BASE_CONFIG, ...KIND_OVERRIDES[kind] };
  return {
    ...base,
    autoscale: { ...BASE_CONFIG.autoscale },
    circuitBreaker: { ...BASE_CONFIG.circuitBreaker },
  };
}

/** Builds a node with default config; `overrides` are merged on top. */
export function createNode(
  id: string,
  kind: ComponentKind,
  position: Position = { x: 0, y: 0 },
  overrides: Partial<NodeConfig> = {},
  label: string = KIND_LABELS[kind],
): DesignNode {
  return { id, kind, label, position, config: { ...defaultConfig(kind), ...overrides } };
}

export function createEdge(
  source: string,
  target: string,
  weight = 1,
  traffic: EdgeTraffic = 'all',
): DesignEdge {
  const suffix = traffic === 'all' ? '' : `:${traffic}`;
  return { id: `${source}->${target}${suffix}`, source, target, weight, traffic };
}

export function createDesign(
  name: string,
  nodes: DesignNode[],
  edges: DesignEdge[],
  traffic: Partial<TrafficSettings> = {},
): Design {
  return { version: 1, name, nodes, edges, traffic: { ...DEFAULT_TRAFFIC, ...traffic } };
}
