import type { ComponentKind, NodeConfig } from '@syssim/engine';

type NumericKey = Exclude<keyof NodeConfig, 'autoscale'>;

export interface ConfigField {
  key: NumericKey;
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
    label: 'Capacity / instance (req/s)',
    hint: 'Max throughput of one instance',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'instances',
    label: 'Instances',
    hint: 'Running instances (the primary count for databases)',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'replicas',
    label: 'Read replicas',
    hint: 'Reads go to replicas; writes always go to the primary',
    min: 0,
    kinds: ['database'],
  },
  {
    key: 'consumerRps',
    label: 'Consumer rate (msg/s)',
    hint: 'How fast consumers drain the queue',
    min: 0,
    kinds: ['queue'],
  },
  {
    key: 'hitRatio',
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
    label: 'Base latency (ms)',
    hint: 'Median service time per request',
    min: 0,
    step: 0.5,
    excludeKinds: ['client'],
  },
  {
    key: 'latencySigma',
    label: 'Latency variance (σ)',
    hint: 'Lognormal sigma: 0 = constant, 0.5 = p99 about 3x the median',
    min: 0,
    max: 3,
    step: 0.05,
    excludeKinds: ['client'],
  },
  {
    key: 'maxConcurrency',
    label: 'Pool size / instance',
    hint: 'Concurrent requests per instance (threads, connections)',
    min: 1,
    excludeKinds: SERVERS,
  },
  {
    key: 'maxQueue',
    label: 'Max queue',
    hint: 'Waiting requests before new ones are dropped',
    min: 0,
    excludeKinds: ['client'],
  },
  {
    key: 'timeoutMs',
    label: 'Timeout (ms)',
    hint: 'Callers give up after this long (0 = never)',
    min: 0,
  },
  {
    key: 'retries',
    label: 'Retries',
    hint: 'Retries for each failed downstream call',
    min: 0,
    max: 10,
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
