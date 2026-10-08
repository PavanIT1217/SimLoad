/** Kinds of components that can be placed in a design. */
export type ComponentKind =
  'client' | 'cdn' | 'loadBalancer' | 'service' | 'cache' | 'queue' | 'database' | 'externalApi';

export const COMPONENT_KINDS: readonly ComponentKind[] = [
  'client',
  'cdn',
  'loadBalancer',
  'service',
  'cache',
  'queue',
  'database',
  'externalApi',
];

/** Horizontal autoscaling policy for a node. */
export interface AutoscaleConfig {
  enabled: boolean;
  /** Time between deciding to scale and the new instances serving traffic. */
  delayMs: number;
  minInstances: number;
  maxInstances: number;
  /** Target saturation (offered / capacity), 0..1. */
  targetUtilization: number;
}

/** Opens when callers see too many failures, then fails fast until `openMs` passes. */
export interface CircuitBreakerConfig {
  enabled: boolean;
  /** Failure fraction (0..1) that trips the breaker. */
  errorThreshold: number;
  /** How long the breaker stays open before letting probe traffic through. */
  openMs: number;
}

/**
 * Tunable properties of a node. Every kind carries the full set so a design is
 * a plain, uniform data structure; kind-specific fields are ignored elsewhere.
 */
export interface NodeConfig {
  /** Max throughput of one instance in req/s. */
  capacityRps: number;
  instances: number;
  /** Median service latency of one request at this node. */
  baseLatencyMs: number;
  /** Lognormal sigma of service latency (0 = deterministic). */
  latencySigma: number;
  /** Concurrent requests one instance can hold (worker / connection pool size). */
  maxConcurrency: number;
  /** Max requests waiting in the backlog before new ones are dropped. */
  maxQueue: number;
  /** Callers give up on a request to this node after this long (0 = no timeout). */
  timeoutMs: number;
  /** Retries this node performs for each failed downstream call. */
  retries: number;
  /** Read hit ratio for cache and CDN nodes, 0..1. */
  hitRatio: number;
  /** Read replicas for database nodes (writes always go to the primary). */
  replicas: number;
  /** Drain rate of a queue node in msg/s. */
  consumerRps: number;
  /** Base delay before a retry; grows 2^n with full jitter (0 = retry immediately). */
  retryBackoffMs: number;
  /** Max retries as a fraction of first attempts (0 = unlimited), like gRPC retry budgets. */
  retryBudget: number;
  /** Requests above this rate are shed immediately with an error (0 = no limit). */
  rateLimitRps: number;
  /** Database shards; each shard has `instances` primaries and `replicas` replicas. */
  shards: number;
  /** 0 = keys spread evenly, 1 = all traffic hits one shard (hot key). */
  hotKeySkew: number;
  /** Extra latency served by freshly started instances while they warm up. */
  coldStartMs: number;
  /** Price of one instance per hour (USD). */
  costPerHour: number;
  /** Price per million requests served (USD), for managed services. */
  costPerMillion: number;
  autoscale: AutoscaleConfig;
  circuitBreaker: CircuitBreakerConfig;
}

export interface Position {
  x: number;
  y: number;
}

export interface DesignNode {
  id: string;
  kind: ComponentKind;
  label: string;
  position: Position;
  config: NodeConfig;
  /** Availability zone or region label, used for zone-outage chaos (optional). */
  zone?: string;
}

export type RequestClass = 'read' | 'write';

/** Which requests an edge carries. */
export type EdgeTraffic = 'all' | RequestClass;

export interface DesignEdge {
  id: string;
  source: string;
  target: string;
  /** Relative routing weight among the source's outgoing edges for the same class. */
  weight: number;
  /** Request class this edge carries (default 'all'), e.g. reads to a cache, writes to a queue. */
  traffic?: EdgeTraffic;
}

export type TrafficProfile = 'steady' | 'dailyWave' | 'flashSpike' | 'ramp';

export interface TrafficSettings {
  /** Peak offered load in req/s across all clients. */
  peakRps: number;
  profile: TrafficProfile;
  /** Fraction of requests that are reads, 0..1. */
  readRatio: number;
}

export interface Design {
  version: 1;
  name: string;
  nodes: DesignNode[];
  edges: DesignEdge[];
  traffic: TrafficSettings;
}

/** A chaos fault injected into a running simulation. */
export type Fault =
  | { kind: 'kill' }
  | { kind: 'latency'; addMs: number }
  | { kind: 'errorRate'; rate: number }
  | { kind: 'flushCache' };

export type FaultKind = Fault['kind'];

export interface SimulationOptions {
  seed: number;
  /** Simulated time per tick. */
  tickMs: number;
  /** Individual requests sampled through the graph each tick. */
  samplesPerTick: number;
  /** Ticks of samples used for rolling percentiles. */
  percentileWindowTicks: number;
  /** Request traces returned per tick. */
  maxTraces: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'NO_CLIENT'
    | 'CYCLE'
    | 'UNREACHABLE'
    | 'DANGLING_EDGE'
    | 'DUPLICATE_ID'
    | 'INVALID_CONFIG'
    | 'CLIENT_HAS_INPUT'
    | 'SELF_LOOP';
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}
