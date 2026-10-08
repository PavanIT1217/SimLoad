import type { CompiledGraph } from '../model/graph';
import type { Rng } from '../util/rng';
import { callerWaitMs, isAsync, isCaching } from './components';
import type { FlowResult, NodeFlow } from './flow';
import { callSuccess } from './flow';
import { retryPlan } from './resilience';
import { liveRoutes } from './routing';
import type { NodeRuntime } from './state';
import type { RequestClass } from './propagation';
import { FAST_FAIL_MS } from './propagation';

export type SpanOutcome =
  'ok' | 'hit' | 'enqueued' | 'dropped' | 'timeout' | 'error' | 'unavailable' | 'rejected';

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
  runtimes: Map<string, NodeRuntime>;
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
  if (flow.admit < 1 && ctx.rng.next() >= flow.admit) return fail('rejected', FAST_FAIL_MS);
  const pool = ctx.cls === 'read' ? flow.readPool : flow.writePool;
  const dropProb = pool ? (ctx.cls === 'read' ? pool.dropRead : pool.dropWrite) : 0;
  if (dropProb > 0 && ctx.rng.next() < dropProb) return fail('dropped', FAST_FAIL_MS);

  const service =
    node.kind === 'client' ? 0 : ctx.rng.lognormal(cfg.baseLatencyMs, cfg.latencySigma);
  const cold = flow.coldFraction > 0 && ctx.rng.next() < flow.coldFraction ? cfg.coldStartMs : 0;
  const local = service + callerWaitMs(node, pool?.result.waitMs ?? 0) + flow.injectedMs + cold;
  if (flow.errorRate > 0 && ctx.rng.next() < flow.errorRate) return fail('error', local);

  let downstream = 0;
  let ok = true;
  const routes = liveRoutes(ctx.graph, ctx.runtimes, node, ctx.cls);
  if (isCaching(node) && ctx.cls === 'read' && ctx.rng.next() < flow.hitRatio) {
    span.outcome = 'hit';
  } else if (isAsync(node)) {
    span.outcome = 'enqueued';
  } else if (routes.length > 0) {
    const route = routes[ctx.rng.weightedIndex(routes.map((r) => r.share))];
    if (route) {
      ok = false;
      const target = ctx.runtimes.get(route.target) as NodeRuntime;
      const plan = retryPlan(
        callSuccess(target, ctx.cls),
        cfg.retries,
        cfg.retryBudget,
        cfg.retryBackoffMs,
      );
      for (let a = 0; a <= cfg.retries && !ok; a++) {
        if (a > 0) {
          // The retry budget may deny this retry; otherwise wait with jittered backoff.
          if (plan.allowed < 1 && ctx.rng.next() >= plan.allowed) break;
          downstream += ctx.rng.next() * cfg.retryBackoffMs * Math.pow(2, a - 1);
        }
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
  runtimes: Map<string, NodeRuntime>,
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
    const ctx: WalkContext = { graph, flows, runtimes, rng, cls, spans: [], visits: 0 };
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
