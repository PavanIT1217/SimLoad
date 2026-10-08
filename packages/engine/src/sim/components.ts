import type { DesignNode, NodeConfig } from '../model/types';

export type PoolName = 'main' | 'primary' | 'replica';

/** One independently queued service pool inside a node. */
export interface PoolSpec {
  name: PoolName;
  capacityRps: number;
  servers: number;
  maxQueue: number;
}

/** How a node's capacity is divided into pools and which pool serves each class. */
export interface PoolLayout {
  pools: PoolSpec[];
  readPool: PoolName | null;
  writePool: PoolName | null;
}

/**
 * Throughput of one instance: the configured capacity, further limited by the
 * concurrency pool (Little's Law: max rps = slots / service time).
 */
export function perInstanceCapacity(config: NodeConfig): number {
  const serviceS = Math.max(config.baseLatencyMs, 0.001) / 1000;
  return Math.min(config.capacityRps, config.maxConcurrency / serviceS);
}

/** Pool layout for a node running `instances` instances. */
export function poolLayout(node: DesignNode, instances: number): PoolLayout {
  const cfg = node.config;
  switch (node.kind) {
    case 'client':
      return { pools: [], readPool: null, writePool: null };
    case 'queue':
      // The queue accepts everything immediately; its backlog drains at the consumer rate.
      return {
        pools: [
          {
            name: 'main',
            capacityRps: cfg.consumerRps,
            servers: cfg.maxConcurrency,
            maxQueue: cfg.maxQueue,
          },
        ],
        readPool: 'main',
        writePool: 'main',
      };
    case 'database': {
      const perInstance = perInstanceCapacity(cfg);
      const primary: PoolSpec = {
        name: 'primary',
        capacityRps: perInstance * instances,
        servers: cfg.maxConcurrency * instances,
        maxQueue: cfg.maxQueue,
      };
      const replicas = Math.floor(cfg.replicas);
      if (replicas <= 0) return { pools: [primary], readPool: 'primary', writePool: 'primary' };
      const replica: PoolSpec = {
        name: 'replica',
        capacityRps: perInstance * replicas,
        servers: cfg.maxConcurrency * replicas,
        maxQueue: cfg.maxQueue,
      };
      return { pools: [primary, replica], readPool: 'replica', writePool: 'primary' };
    }
    default:
      return {
        pools: [
          {
            name: 'main',
            capacityRps: perInstanceCapacity(cfg) * instances,
            servers: cfg.maxConcurrency * instances,
            maxQueue: cfg.maxQueue,
          },
        ],
        readPool: 'main',
        writePool: 'main',
      };
  }
}

/** Whether reads can be answered locally (cache hits). */
export function isCaching(node: DesignNode): boolean {
  return node.kind === 'cache' || node.kind === 'cdn';
}

/** Whether the node acknowledges callers before downstream work completes. */
export function isAsync(node: DesignNode): boolean {
  return node.kind === 'queue';
}

/**
 * Queueing delay a caller experiences at this node. Queue nodes acknowledge
 * on enqueue, so their backlog does not delay producers.
 */
export function callerWaitMs(node: DesignNode, poolWaitMs: number): number {
  return isAsync(node) ? 0 : poolWaitMs;
}

/** Expected extra attempts per call with failure probability `f` and `retries` retries. */
export function retryFactor(f: number, retries: number): number {
  let extra = 0;
  let term = 1;
  for (let k = 1; k <= retries; k++) {
    term *= f;
    extra += term;
  }
  return extra;
}

/** Probability a call succeeds within `retries` retries given per-attempt success `s`. */
export function successWithRetries(s: number, retries: number): number {
  return 1 - Math.pow(1 - s, retries + 1);
}
