import type { CompiledGraph } from '../model/graph';
import type { Rng } from '../util/rng';
import { callerWaitMs, isAsync, isCaching } from './components';
import type { FlowResult, NodeFlow } from './flow';
import type { RequestClass } from './propagation';
import { FAST_FAIL_MS } from './propagation';

export type SpanOutcome =
  'ok' | 'hit' | 'enqueued' | 'dropped' | 'timeout' | 'error' | 'unavailable';

export interface TraceSpan {
  nodeId: string;
  depth: number;
  startMs: number;
  durationMs: number;
  outcome: SpanOutcome;
  /** 0 for the first attempt, 1+ for retries. */
  attempt: number;
}

export interface RequestTrace {
  id: number;
  cls: RequestClass;
  latencyMs: number;
  ok: boolean;
  spans: TraceSpan[];
}

/** Hard cap on node visits per sampled request, bounding retry fan-out. */
export const MAX_VISITS_PER_REQUEST = 64;

interface WalkContext {
  graph: CompiledGraph;
  flows: FlowResult;
  rng: Rng;
  cls: RequestClass;
  spans: TraceSpan[];
  visits: number;
}

interface WalkResult {
  durationMs: number;
  ok: boolean;
}

function walk(
  ctx: WalkContext,
  nodeId: string,
  depth: number,
  startMs: number,
  attempt: number,
): WalkResult {
  const flow = ctx.flows.nodes.get(nodeId) as NodeFlow;
  const { node } = flow;
  const cfg = node.config;
  const span: TraceSpan = { nodeId, depth, startMs, durationMs: 0, outcome: 'ok', attempt };
  ctx.spans.push(span);
  ctx.visits++;
  const fail = (outcome: SpanOutcome, durationMs: number): WalkResult => {
    span.outcome = outcome;
    span.durationMs = durationMs;
    return { durationMs, ok: false };
  };

  if (flow.failed || ctx.visits > MAX_VISITS_PER_REQUEST) return fail('unavailable', FAST_FAIL_MS);
  const pool = ctx.cls === 'read' ? flow.readPool : flow.writePool;
  const dropProb = pool ? (ctx.cls === 'read' ? pool.dropRead : pool.dropWrite) : 0;
  if (dropProb > 0 && ctx.rng.next() < dropProb) return fail('dropped', FAST_FAIL_MS);

  const service =
    node.kind === 'client' ? 0 : ctx.rng.lognormal(cfg.baseLatencyMs, cfg.latencySigma);
  const local = service + callerWaitMs(node, pool?.result.waitMs ?? 0) + flow.injectedMs;
  if (flow.errorRate > 0 && ctx.rng.next() < flow.errorRate) return fail('error', local);

  let downstream = 0;
  let ok = true;
  const routes = ctx.graph.routes.get(nodeId) ?? [];
  if (isCaching(node) && ctx.cls === 'read' && ctx.rng.next() < flow.hitRatio) {
    span.outcome = 'hit';
  } else if (isAsync(node)) {
    span.outcome = 'enqueued';
  } else if (routes.length > 0) {
    const route = routes[ctx.rng.weightedIndex(routes.map((r) => r.share))];
    if (route) {
      ok = false;
      for (let a = 0; a <= cfg.retries && !ok; a++) {
        const child = walk(ctx, route.target, depth + 1, startMs + local + downstream, a);
        downstream += child.durationMs;
        ok = child.ok;
      }
    }
  }

  let total = local + downstream;
  if (cfg.timeoutMs > 0 && total > cfg.timeoutMs) {
    total = cfg.timeoutMs;
    span.outcome = 'timeout';
    ok = false;
  } else if (!ok) {
    span.outcome = 'error';
  }
  span.durationMs = total;
  return { durationMs: total, ok };
}

/**
 * Sample layer: walks `count` individual requests through the graph using
 * the flow layer's current state (queue waits, drop/error probabilities,
 * hit ratios) to produce realistic latency distributions and traces.
 */
export function sampleRequests(
  graph: CompiledGraph,
  flows: FlowResult,
  rng: Rng,
  count: number,
  readRatio: number,
  firstId: number,
): RequestTrace[] {
  const traces: RequestTrace[] = [];
  if (graph.clients.length === 0) return traces;
  for (let i = 0; i < count; i++) {
    const client = graph.clients[Math.floor(rng.next() * graph.clients.length)] as string;
    const cls: RequestClass = rng.next() < readRatio ? 'read' : 'write';
    const ctx: WalkContext = { graph, flows, rng, cls, spans: [], visits: 0 };
    const result = walk(ctx, client, 0, 0, 0);
    traces.push({
      id: firstId + i,
      cls,
      latencyMs: result.durationMs,
      ok: result.ok,
      spans: ctx.spans,
    });
  }
  return traces;
}
