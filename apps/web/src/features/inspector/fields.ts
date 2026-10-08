import type { ComponentKind, NodeConfig } from '@simload/engine';

type NumericKey = Exclude<keyof NodeConfig, 'autoscale' | 'circuitBreaker'>;

export type FieldGroup = 'capacity' | 'latency' | 'resilience' | 'cost';

export const GROUP_LABELS: Record<FieldGroup, string> = {
  capacity: 'Capacity',
  latency: 'Latency & queueing',
  resilience: 'Resilience',
  cost: 'Cost',
};

export interface ConfigField {
  key: NumericKey;
  group: FieldGroup;
  label: string;
  hint: string;
  min: number;
  max?: number;
  step?: number;
  /** Display multiplier (100 shows fractions as percentages). */
  scale?: number;
  kinds?: readonly ComponentKind[];
  excludeKinds?: readonly ComponentKind[];
}

const SERVERS: readonly ComponentKind[] = ['client', 'queue'];

export const CONFIG_FIELDS: readonly ConfigField[] = [
  {
    key: 'capacityRps',
    group: 'capacity',
    label: 'Capacity / instance (req/s)',
    hint: 'Max throughput of one instance',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'instances',
    group: 'capacity',
    label: 'Instances',
    hint: 'Running instances (the primary count for databases)',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'replicas',
    group: 'capacity',
    label: 'Read replicas',
    hint: 'Reads go to replicas; writes always go to the primary',
    min: 0,
    kinds: ['database'],
  },
  {
    key: 'consumerRps',
    group: 'capacity',
    label: 'Consumer rate (msg/s)',
    hint: 'How fast consumers drain the queue',
    min: 0,
    kinds: ['queue'],
  },
  {
    key: 'hitRatio',
    group: 'capacity',
    label: 'Read hit ratio (%)',
    hint: 'Share of reads answered from cache',
    min: 0,
    max: 1,
    step: 1,
    scale: 100,
    kinds: ['cache', 'cdn'],
  },
  {
    key: 'baseLatencyMs',
    group: 'latency',
    label: 'Base latency (ms)',
    hint: 'Median service time per request',
    min: 0,
    step: 0.5,
    excludeKinds: ['client'],
  },
  {
    key: 'latencySigma',
    group: 'latency',
    label: 'Latency variance (σ)',
    hint: 'Lognormal sigma: 0 = constant, 0.5 = p99 about 3x the median',
    min: 0,
    max: 3,
    step: 0.05,
    excludeKinds: ['client'],
  },
  {
    key: 'maxConcurrency',
    group: 'capacity',
    label: 'Pool size / instance',
    hint: 'Concurrent requests per instance (threads, connections)',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'maxQueue',
    group: 'latency',
    label: 'Max queue',
    hint: 'Waiting requests before new ones are dropped',
    min: 0,
    excludeKinds: ['client'],
  },
  {
    key: 'timeoutMs',
    group: 'resilience',
    label: 'Timeout (ms)',
    hint: 'Callers give up after this long (0 = never)',
    min: 0,
  },
  {
    key: 'retries',
    group: 'resilience',
    label: 'Retries',
    hint: 'Retries for each failed downstream call',
    min: 0,
    max: 10,
  },
  {
    key: 'shards',
    group: 'capacity',
    label: 'Shards',
    hint: 'Each shard has its own primary (and replicas)',
    min: 1,
    kinds: ['database'],
  },
  {
    key: 'hotKeySkew',
    group: 'capacity',
    label: 'Hot-key skew (%)',
    hint: '0 = even key spread, 100 = one shard takes everything',
    min: 0,
    max: 1,
    scale: 100,
    kinds: ['database'],
  },
  {
    key: 'coldStartMs',
    group: 'latency',
    label: 'Cold start (ms)',
    hint: 'Extra latency on newly started instances for 10 s',
    min: 0,
    excludeKinds: ['client', 'queue', 'cdn', 'externalApi'],
  },
  {
    key: 'retryBackoffMs',
    group: 'resilience',
    label: 'Retry backoff (ms)',
    hint: 'Base delay; doubles each retry, with full jitter',
    min: 0,
  },
  {
    key: 'retryBudget',
    group: 'resilience',
    label: 'Retry budget (%)',
    hint: 'Max retries as a share of first attempts (0 = unlimited)',
    min: 0,
    max: 1,
    scale: 100,
  },
  {
    key: 'rateLimitRps',
    group: 'resilience',
    label: 'Rate limit (req/s)',
    hint: 'Shed load above this rate with fast errors (0 = off)',
    min: 0,
    excludeKinds: ['client'],
  },
  {
    key: 'costPerHour',
    group: 'cost',
    label: '$ / instance / hour',
    hint: 'On-demand price of one instance',
    min: 0,
    step: 0.01,
    excludeKinds: ['client'],
  },
  {
    key: 'costPerMillion',
    group: 'cost',
    label: '$ / million requests',
    hint: 'Usage-based price (managed services, CDN, APIs)',
    min: 0,
    step: 0.01,
    excludeKinds: ['client'],
  },
];

export function fieldsFor(kind: ComponentKind): ConfigField[] {
  return CONFIG_FIELDS.filter(
    (f) => (!f.kinds || f.kinds.includes(kind)) && !f.excludeKinds?.includes(kind),
  );
}

export function supportsAutoscale(kind: ComponentKind): boolean {
  return kind !== 'client' && kind !== 'queue';
}
