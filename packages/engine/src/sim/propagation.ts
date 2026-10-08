import type { CompiledGraph } from '../model/graph';
import { lognormalExceedance, lognormalMean } from '../util/math';
import { callerWaitMs, isAsync, isCaching, retryFactor, successWithRetries } from './components';
import type { FlowResult, NodeFlow } from './flow';
import type { NodeRuntime } from './state';

/** Latency of a fast failure (connection refused, queue full). */
export const FAST_FAIL_MS = 0.5;

export type RequestClass = 'read' | 'write';

/** End-to-end outcome of calling a node, as seen by its callers. */
export interface ClassOutcome {
  /** Probability the call succeeds, including everything downstream. */
  success: number;
  /** Mean end-to-end latency in ms. */
  latencyMs: number;
  /** Mean time spent at this node only (service + queueing + injected). */
  localLatencyMs: number;
  /** Fraction of calls that time out at this node. */
  timeoutRate: number;
}

export interface NodeOutcome {
  read: ClassOutcome;
  write: ClassOutcome;
}

function classOutcome(
  flow: NodeFlow,
  cls: RequestClass,
  graph: CompiledGraph,
  runtimes: Map<string, NodeRuntime>,
): ClassOutcome {
  const { node } = flow;
  const cfg = node.config;
  if (flow.failed) {
    return { success: 0, latencyMs: FAST_FAIL_MS, localLatencyMs: FAST_FAIL_MS, timeoutRate: 0 };
  }
  const pool = cls === 'read' ? flow.readPool : flow.writePool;
  const drop = pool ? (cls === 'read' ? pool.dropRead : pool.dropWrite) : 0;
  const waitMs = callerWaitMs(node, pool?.result.waitMs ?? 0);
  const base = node.kind === 'client' ? 0 : cfg.baseLatencyMs;
  const localLatencyMs = lognormalMean(base, cfg.latencySigma) + waitMs + flow.injectedMs;

  const routes = graph.routes.get(node.id) ?? [];
  let continuation = routes.length > 0 ? 1 : 0;
  if (isAsync(node)) continuation = 0;
  else if (isCaching(node) && cls === 'read') continuation *= 1 - flow.hitRatio;

  let downstreamSuccess = 1;
  let downstreamLatency = 0;
  if (continuation > 0) {
    downstreamSuccess = 0;
    for (const route of routes) {
      const child = runtimes.get(route.target) as NodeRuntime;
      const s = cls === 'read' ? child.successRead : child.successWrite;
      const l = cls === 'read' ? child.latencyReadMs : child.latencyWriteMs;
      downstreamSuccess += route.share * successWithRetries(s, cfg.retries);
      downstreamLatency += route.share * l * (1 + retryFactor(1 - s, cfg.retries));
    }
  }
  const expectedDownstream = continuation * downstreamLatency;
  const timeoutRate =
    cfg.timeoutMs > 0
      ? lognormalExceedance(
          base,
          cfg.latencySigma,
          waitMs + flow.injectedMs + expectedDownstream,
          cfg.timeoutMs,
        )
      : 0;
  const success =
    (1 - drop) *
    (1 - flow.errorRate) *
    (1 - timeoutRate) *
    (1 - continuation + continuation * downstreamSuccess);
  let latencyMs = localLatencyMs + expectedDownstream;
  if (cfg.timeoutMs > 0) latencyMs = Math.min(latencyMs, cfg.timeoutMs);
  return { success, latencyMs, localLatencyMs, timeoutRate };
}

/**
 * Backward pass of the flow layer: walks the DAG in reverse topological
 * order, combining each node's local drop, error and timeout rates with its
 * downstream outcomes. Results are written to the runtimes so the next tick's
 * forward pass can compute retry amplification.
 */
export function backwardPass(
  graph: CompiledGraph,
  flows: FlowResult,
  runtimes: Map<string, NodeRuntime>,
): Map<string, NodeOutcome> {
  const outcomes = new Map<string, NodeOutcome>();
  for (let i = graph.order.length - 1; i >= 0; i--) {
    const id = graph.order[i] as string;
    const flow = flows.nodes.get(id) as NodeFlow;
    const runtime = runtimes.get(id) as NodeRuntime;
    const read = classOutcome(flow, 'read', graph, runtimes);
    const write = classOutcome(flow, 'write', graph, runtimes);
    runtime.successRead = read.success;
    runtime.successWrite = write.success;
    runtime.latencyReadMs = read.latencyMs;
    runtime.latencyWriteMs = write.latencyMs;
    outcomes.set(id, { read, write });
  }
  return outcomes;
}
