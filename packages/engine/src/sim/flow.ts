import { REQUEST_CLASSES } from '../model/graph';
import type { CompiledGraph } from '../model/graph';
import type { DesignNode, RequestClass } from '../model/types';
import { isCaching } from './components';
import type { ClassRates, NodePools } from './nodePools';
import { applyRateLimit, runPools } from './nodePools';
import { breakerAdmit, retryPlan } from './resilience';
import type { NodeRuntime } from './state';
import {
  clearBacklog,
  coldFraction,
  injectedErrorRate,
  injectedLatencyMs,
  isKilled,
} from './state';

export type { ClassRates, PoolFlow } from './nodePools';

/** Flow-layer state of one node for the current tick. */
export interface NodeFlow extends NodePools {
  node: DesignNode;
  inflow: ClassRates;
  /** Rates forwarded downstream, before retry amplification. */
  outflow: ClassRates;
  /** Extra downstream calls caused by this node's retries. */
  retryRps: number;
  /** Requests rejected by this node's rate limit. */
  shedRps: number;
  /** Calls into this node rejected by its open circuit breaker. */
  rejectedRps: number;
  /** Fraction of calls this node's breaker admits (1 when closed). */
  admit: number;
  failed: boolean;
  injectedMs: number;
  errorRate: number;
  /** Effective read hit ratio (cache/CDN), including warm-up after a flush. */
  hitRatio: number;
  /** Fraction of requests served by cold (just-started) instances. */
  coldFraction: number;
}

export interface FlowResult {
  nodes: Map<string, NodeFlow>;
  edges: Map<string, number>;
}

/** Probability a call into `runtime` succeeds, counting breaker rejections as failures. */
export function callSuccess(runtime: NodeRuntime, cls: RequestClass): number {
  const s = cls === 'read' ? runtime.successRead : runtime.successWrite;
  return breakerAdmit(runtime) * s;
}

/**
 * Forward pass of the flow layer: pushes request rates through the DAG in
 * topological order, stepping each node's queues and splitting outflow over
 * its edges per request class. Retries use the previous tick's downstream
 * success, so retry storms build up over successive ticks.
 */
export function forwardPass(
  graph: CompiledGraph,
  runtimes: Map<string, NodeRuntime>,
  clientRates: ClassRates,
  dtS: number,
): FlowResult {
  const inflows = new Map<string, ClassRates>();
  const rejected = new Map<string, number>();
  const nodes = new Map<string, NodeFlow>();
  const edges = new Map<string, number>();

  for (const id of graph.order) {
    const node = graph.nodes.get(id) as DesignNode;
    const runtime = runtimes.get(id) as NodeRuntime;
    const cfg = node.config;
    const inflow =
      node.kind === 'client' ? { ...clientRates } : (inflows.get(id) ?? { read: 0, write: 0 });
    const failed = isKilled(runtime);
    if (failed) clearBacklog(runtime);
    const errorRate = injectedErrorRate(runtime);
    const hitRatio = isCaching(node) ? cfg.hitRatio * runtime.cacheWarmth : 0;
    const { admitted, shed } = applyRateLimit(node, inflow);
    const pools = runPools(node, runtime, admitted, shed, dtS, failed);

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
    const routes = graph.routes.get(id);
    for (const cls of REQUEST_CLASSES) {
      for (const route of routes?.[cls] ?? []) {
        const target = runtimes.get(route.target) as NodeRuntime;
        const plan = retryPlan(
          callSuccess(target, cls),
          cfg.retries,
          cfg.retryBudget,
          cfg.retryBackoffMs,
        );
        const first = outflow[cls] * route.share;
        const sent = first * (1 + plan.extra);
        const delivered = sent * breakerAdmit(target);
        retryRps += first * plan.extra;
        rejected.set(route.target, (rejected.get(route.target) ?? 0) + sent - delivered);
        edges.set(route.edgeId, (edges.get(route.edgeId) ?? 0) + delivered);
        const targetIn = inflows.get(route.target) ?? { read: 0, write: 0 };
        targetIn[cls] += delivered;
        inflows.set(route.target, targetIn);
      }
    }

    nodes.set(id, {
      node,
      inflow,
      outflow,
      retryRps,
      shedRps: shed.read + shed.write,
      rejectedRps: rejected.get(id) ?? 0,
      admit: breakerAdmit(runtime),
      ...pools,
      failed,
      injectedMs: injectedLatencyMs(runtime),
      errorRate,
      hitRatio,
      coldFraction: coldFraction(runtime),
    });
  }
  return { nodes, edges };
}
