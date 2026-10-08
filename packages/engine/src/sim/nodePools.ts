import type { DesignNode } from '../model/types';
import type { PoolName, PoolSpec } from './components';
import { poolLayout } from './components';
import type { PoolResult } from './pool';
import { stepPool } from './pool';
import type { NodeRuntime } from './state';

export interface ClassRates {
  read: number;
  write: number;
}

export interface PoolFlow {
  spec: PoolSpec;
  result: PoolResult;
  /** Probability that an arriving request of each class is dropped (queue full or shed). */
  dropRead: number;
  dropWrite: number;
}

export interface NodePools {
  pools: Map<PoolName, PoolFlow>;
  readPool: PoolFlow | null;
  writePool: PoolFlow | null;
}

const ZERO_POOL: PoolResult = {
  processedRead: 0,
  processedWrite: 0,
  droppedRead: 0,
  droppedWrite: 0,
  backlog: 0,
  waitMs: 0,
  utilization: 0,
  saturation: 0,
};

function dropProbability(dropped: number, arrivals: number): number {
  if (arrivals <= 0) return 0;
  return Math.min(1, dropped / arrivals);
}

/**
 * Splits inflow above the node's rate limit off as shed load. Shedding is a
 * fast, deliberate rejection: it protects the queue instead of growing it.
 */
export function applyRateLimit(
  node: DesignNode,
  inflow: ClassRates,
): { admitted: ClassRates; shed: ClassRates } {
  const limit = node.config.rateLimitRps;
  const total = inflow.read + inflow.write;
  if (!(limit > 0) || total <= limit || node.kind === 'client') {
    return { admitted: inflow, shed: { read: 0, write: 0 } };
  }
  const keep = limit / total;
  return {
    admitted: { read: inflow.read * keep, write: inflow.write * keep },
    shed: { read: inflow.read * (1 - keep), write: inflow.write * (1 - keep) },
  };
}

/** Steps every pool of a node for one tick. Shed load counts as dropped. */
export function runPools(
  node: DesignNode,
  runtime: NodeRuntime,
  admitted: ClassRates,
  shed: ClassRates,
  dtS: number,
  failed: boolean,
): NodePools {
  const layout = poolLayout(node, runtime.instances);
  const pools = new Map<PoolName, PoolFlow>();
  for (const spec of layout.pools) {
    const isRead = layout.readPool === spec.name;
    const isWrite = layout.writePool === spec.name;
    const readRps = isRead ? admitted.read : 0;
    const writeRps = isWrite ? admitted.write : 0;
    const shedRead = isRead ? shed.read : 0;
    const shedWrite = isWrite ? shed.write : 0;
    if (failed) {
      // A dead node refuses connections: everything is dropped instantly.
      pools.set(spec.name, {
        spec,
        result: {
          ...ZERO_POOL,
          droppedRead: readRps + shedRead,
          droppedWrite: writeRps + shedWrite,
        },
        dropRead: 1,
        dropWrite: 1,
      });
      continue;
    }
    const stepped = stepPool(runtime.pools[spec.name], {
      readRps,
      writeRps,
      capacityRps: spec.capacityRps,
      servers: spec.servers,
      maxQueue: spec.maxQueue,
      dtS,
    });
    const result: PoolResult = {
      ...stepped,
      droppedRead: stepped.droppedRead + shedRead,
      droppedWrite: stepped.droppedWrite + shedWrite,
    };
    pools.set(spec.name, {
      spec,
      result,
      dropRead: dropProbability(result.droppedRead, readRps + shedRead),
      dropWrite: dropProbability(result.droppedWrite, writeRps + shedWrite),
    });
  }
  return {
    pools,
    readPool: layout.readPool ? (pools.get(layout.readPool) ?? null) : null,
    writePool: layout.writePool ? (pools.get(layout.writePool) ?? null) : null,
  };
}
