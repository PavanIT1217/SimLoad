import type { CompiledGraph } from '../model/graph';
import type { DesignNode } from '../model/types';
import type { PoolName, PoolSpec } from './components';
import { isCaching, poolLayout, retryFactor } from './components';
import type { PoolResult } from './pool';
import { stepPool } from './pool';
import type { NodeRuntime } from './state';
import { clearBacklog, injectedErrorRate, injectedLatencyMs, isKilled } from './state';

export interface ClassRates {
  read: number;
  write: number;
}

export interface PoolFlow {
  spec: PoolSpec;
  result: PoolResult;
  /** Probability that an arriving request of each class is dropped. */
  dropRead: number;
  dropWrite: number;
}

/** Flow-layer state of one node for the current tick. */
export interface NodeFlow {
  node: DesignNode;
  inflow: ClassRates;
  /** Rates forwarded downstream, before retry amplification. */
  outflow: ClassRates;
  /** Extra downstream calls caused by this node's retries. */
  retryRps: number;
  pools: Map<PoolName, PoolFlow>;
  readPool: PoolFlow | null;
  writePool: PoolFlow | null;
  failed: boolean;
  injectedMs: number;
  errorRate: number;
  /** Effective read hit ratio (cache/CDN), including warm-up after a flush. */
  hitRatio: number;
}

export interface FlowResult {
  nodes: Map<string, NodeFlow>;
  edges: Map<string, number>;
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

function runPools(
  node: DesignNode,
  runtime: NodeRuntime,
  inflow: ClassRates,
  dtS: number,
  failed: boolean,
): Pick<NodeFlow, 'pools' | 'readPool' | 'writePool'> {
  const layout = poolLayout(node, runtime.instances);
  const pools = new Map<PoolName, PoolFlow>();
  for (const spec of layout.pools) {
    const readRps = layout.readPool === spec.name ? inflow.read : 0;
    const writeRps = layout.writePool === spec.name ? inflow.write : 0;
    if (failed) {
      // A dead node refuses connections: everything is dropped instantly.
      pools.set(spec.name, {
        spec,
        result: { ...ZERO_POOL, droppedRead: readRps, droppedWrite: writeRps },
        dropRead: 1,
        dropWrite: 1,
      });
      continue;
    }
    const result = stepPool(runtime.pools[spec.name], {
      readRps,
      writeRps,
      capacityRps: spec.capacityRps,
      servers: spec.servers,
      maxQueue: spec.maxQueue,
      dtS,
    });
    pools.set(spec.name, {
      spec,
      result,
      dropRead: dropProbability(result.droppedRead, readRps),
      dropWrite: dropProbability(result.droppedWrite, writeRps),
    });
  }
  return {
    pools,
    readPool: layout.readPool ? (pools.get(layout.readPool) ?? null) : null,
    writePool: layout.writePool ? (pools.get(layout.writePool) ?? null) : null,
  };
}

/**
 * Forward pass of the flow layer: pushes request rates through the DAG in
 * topological order, stepping each node's queues and splitting outflow over
 * its edges. Retries use the previous tick's downstream success, so retry
 * storms build up over successive ticks.
 */
export function forwardPass(
  graph: CompiledGraph,
  runtimes: Map<string, NodeRuntime>,
  clientRates: ClassRates,
  dtS: number,
): FlowResult {
  const inflows = new Map<string, ClassRates>();
  const nodes = new Map<string, NodeFlow>();
  const edges = new Map<string, number>();

  for (const id of graph.order) {
    const node = graph.nodes.get(id) as DesignNode;
    const runtime = runtimes.get(id) as NodeRuntime;
    const inflow =
      node.kind === 'client' ? { ...clientRates } : (inflows.get(id) ?? { read: 0, write: 0 });
    const failed = isKilled(runtime);
    if (failed) clearBacklog(runtime);
    const errorRate = injectedErrorRate(runtime);
    const hitRatio = isCaching(node) ? node.config.hitRatio * runtime.cacheWarmth : 0;
    const pools = runPools(node, runtime, inflow, dtS, failed);

    let outflow: ClassRates;
    if (failed) {
      outflow = { read: 0, write: 0 };
    } else if (node.kind === 'client') {
      outflow = { ...inflow };
    } else {
      const okRead = (pools.readPool?.result.processedRead ?? 0) * (1 - errorRate);
      const okWrite = (pools.writePool?.result.processedWrite ?? 0) * (1 - errorRate);
      outflow = { read: okRead * (1 - hitRatio), write: okWrite };
    }

    let retryRps = 0;
    for (const route of graph.routes.get(id) ?? []) {
      const target = runtimes.get(route.target) as NodeRuntime;
      const retries = node.config.retries;
      const extraRead = retryFactor(1 - target.successRead, retries);
      const extraWrite = retryFactor(1 - target.successWrite, retries);
      const read = outflow.read * route.share;
      const write = outflow.write * route.share;
      retryRps += read * extraRead + write * extraWrite;
      const edgeRead = read * (1 + extraRead);
      const edgeWrite = write * (1 + extraWrite);
      edges.set(route.edgeId, edgeRead + edgeWrite);
      const targetIn = inflows.get(route.target) ?? { read: 0, write: 0 };
      targetIn.read += edgeRead;
      targetIn.write += edgeWrite;
      inflows.set(route.target, targetIn);
    }

    nodes.set(id, {
      node,
      inflow,
      outflow,
      retryRps,
      ...pools,
      failed,
      injectedMs: injectedLatencyMs(runtime),
      errorRate,
      hitRatio,
    });
  }
  return { nodes, edges };
}
