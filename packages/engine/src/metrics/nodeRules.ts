import type { DesignNode } from '../model/types';
import { hottestShardShare, perInstanceCapacity } from '../sim/components';
import type { NodeTickState } from '../sim/result';
import type { Insight } from './insights';
import { fmt, fmtMs, pct } from './insights';

/** Comfortable utilisation target used when recommending capacity. */
export const TARGET_RHO = 0.7;

export interface NodeContext {
  node: DesignNode;
  state: NodeTickState;
  /** Whether any cache or CDN sits upstream of this node. */
  cachedUpstream: boolean;
}

function overloadSuggestions({ node, state, cachedUpstream }: NodeContext): string[] {
  const cfg = node.config;
  const out: string[] = [];
  const perInstance = perInstanceCapacity(cfg);
  const concurrencyCap = (cfg.maxConcurrency * 1000) / Math.max(cfg.baseLatencyMs, 0.001);
  const readShare = state.inflowRps > 0 ? state.readRps / state.inflowRps : 0;

  if (node.kind === 'queue') {
    const growth = state.inflowRps - cfg.consumerRps;
    if (growth > 0) {
      out.push(
        `Raise the consumer rate to at least ${fmt(state.inflowRps)}/s: the backlog grows ${fmt(growth)}/s and fills ${fmt(cfg.maxQueue)} slots in ${fmtMs((cfg.maxQueue / growth) * 1000)}.`,
      );
    }
    return out;
  }
  if (node.kind === 'database') {
    const scale = 1 / hottestShardShare(cfg);
    const perReplica = perInstance * scale;
    if (readShare > 0.5 && cfg.replicas === 0) {
      const replicas = Math.ceil(state.readRps / (perReplica * TARGET_RHO));
      out.push(`Add ${replicas} read replica(s): ${pct(readShare)} of the load is reads.`);
    } else if (cfg.replicas > 0 && state.readRps > perReplica * cfg.replicas * TARGET_RHO) {
      const replicas = Math.ceil(state.readRps / (perReplica * TARGET_RHO));
      out.push(`Grow read replicas from ${cfg.replicas} to ${replicas}.`);
    }
    const primaryCap = perInstance * cfg.instances * scale;
    if (state.writeRps > primaryCap * TARGET_RHO) {
      const shards = Math.ceil((cfg.shards * state.writeRps) / (primaryCap * TARGET_RHO));
      out.push(
        `Writes (${fmt(state.writeRps)}/s) exceed one primary: shard to ~${shards} shards, or buffer writes through a queue.`,
      );
    }
    if (cfg.shards > 1 && cfg.hotKeySkew > 0.2) {
      out.push(
        `Hot key: the hottest shard takes ${pct(hottestShardShare(cfg))} of traffic. Cache hot keys or salt the key space.`,
      );
    }
  } else {
    const needed = Math.ceil(state.inflowRps / (perInstance * TARGET_RHO));
    out.push(
      `Scale to ${needed} instances (now ${state.instances}) to run at ${pct(TARGET_RHO)} utilisation.`,
    );
    if (concurrencyCap < cfg.capacityRps) {
      const pool = Math.ceil((cfg.capacityRps * cfg.baseLatencyMs) / 1000);
      out.push(
        `Each instance is limited by its pool (${cfg.maxConcurrency} slots ÷ ${fmtMs(cfg.baseLatencyMs)} = ${fmt(concurrencyCap)}/s). A pool of ${pool} unlocks the full ${fmt(cfg.capacityRps)}/s.`,
      );
    }
  }
  if (!cachedUpstream && readShare > 0.6 && node.kind !== 'cache' && node.kind !== 'cdn') {
    const after = state.inflowRps * (1 - 0.9 * readShare);
    out.push(
      `Put a cache in front: at a 90% hit ratio this node would see ${fmt(after)}/s instead of ${fmt(state.inflowRps)}/s.`,
    );
  }
  if (!cfg.autoscale.enabled && node.kind !== 'database') {
    out.push('Enable autoscaling so capacity follows the load (mind the boot delay).');
  }
  return out;
}

/** Findings for one node; empty when the node looks healthy. */
export function nodeInsights(ctx: NodeContext): Insight[] {
  const { node, state } = ctx;
  const cfg = node.config;
  const id = node.id;
  const out: Insight[] = [];
  const rho = state.saturation;

  if (state.failed) {
    out.push({
      id: `${id}:down`,
      severity: 'critical',
      nodeId: id,
      title: `${node.label} is down`,
      detail: `All ${fmt(state.inflowRps + state.rejectedRps)}/s of calls to it fail.`,
      suggestions: [
        'Run it in more than one zone and route around failures.',
        'Add a circuit breaker so callers fail fast instead of piling on retries.',
      ],
    });
    return out;
  }
  if (state.breaker !== 'closed') {
    out.push({
      id: `${id}:breaker`,
      severity: 'warning',
      nodeId: id,
      title: `Circuit breaker ${state.breaker === 'open' ? 'open' : 'probing'} on ${node.label}`,
      detail: `Callers fail fast on ${fmt(state.rejectedRps)}/s instead of waiting, which lets ${node.label} recover.`,
      suggestions: ['Fix the underlying failure; the breaker closes after a healthy probe.'],
    });
  }
  if (rho >= 1) {
    out.push({
      id: `${id}:overload`,
      severity: 'critical',
      nodeId: id,
      title: `${node.label} is overloaded (ρ = ${rho.toFixed(2)})`,
      detail:
        `It receives λ = ${fmt(state.inflowRps)}/s but can serve μ = ${fmt(state.capacityRps)}/s. ` +
        `Backlog ${fmt(state.queueDepth)}, dropping ${fmt(state.droppedRps)}/s, local latency ${fmtMs(state.latencyMs)}.`,
      suggestions: overloadSuggestions(ctx),
    });
  } else if (rho >= 0.7 && node.kind !== 'queue') {
    out.push({
      id: `${id}:hot`,
      severity: 'warning',
      nodeId: id,
      title: `${node.label} is near saturation (ρ = ${rho.toFixed(2)})`,
      detail: 'Queueing delay grows like ρ/(1−ρ): the last 30% of capacity costs the most latency.',
      suggestions: overloadSuggestions(ctx).slice(0, 2),
    });
  }
  if (state.timeoutRate > 0.01) {
    out.push({
      id: `${id}:timeouts`,
      severity: 'warning',
      nodeId: id,
      title: `${pct(state.timeoutRate)} of calls to ${node.label} time out`,
      detail: `End-to-end latency ${fmtMs(state.e2eLatencyMs)} against a ${fmtMs(cfg.timeoutMs)} timeout.`,
      suggestions: [
        'Reduce latency downstream (capacity, caching) rather than only raising the timeout.',
        'Timed-out work still consumes capacity: retries on timeouts amplify load.',
      ],
    });
  }
  if (state.retryRps > 0.1 * Math.max(1, state.inflowRps)) {
    out.push({
      id: `${id}:retries`,
      severity: 'warning',
      nodeId: id,
      title: `Retry storm from ${node.label}`,
      detail: `Retries add ${fmt(state.retryRps)}/s (${pct(state.retryRps / Math.max(1, state.inflowRps))} extra load) on a struggling dependency.`,
      suggestions: [
        cfg.retryBudget > 0 ? 'Tighten the retry budget.' : 'Add a retry budget (e.g. 10%).',
        cfg.retryBackoffMs > 0 ? 'Increase backoff.' : 'Add exponential backoff with jitter.',
        'Add a circuit breaker on the dependency.',
      ],
    });
  }
  if (state.shedRps > 0) {
    out.push({
      id: `${id}:shed`,
      severity: 'info',
      nodeId: id,
      title: `${node.label} is shedding ${fmt(state.shedRps)}/s`,
      detail: `The ${fmt(cfg.rateLimitRps)}/s rate limit protects it from queueing, at the cost of fast errors.`,
      suggestions: ['Raise the limit only if downstream capacity allows it.'],
    });
  }
  if ((node.kind === 'cache' || node.kind === 'cdn') && state.hitRatio < cfg.hitRatio - 0.05) {
    out.push({
      id: `${id}:cold-cache`,
      severity: 'info',
      nodeId: id,
      title: `${node.label} is warming up (hit ratio ${pct(state.hitRatio)} of ${pct(cfg.hitRatio)})`,
      detail: 'Misses go straight to the origin: a cache stampede after a flush or restart.',
      suggestions: ['Pre-warm caches before cut-over, or coalesce concurrent misses.'],
    });
  }
  if (state.coldFraction > 0 && cfg.coldStartMs > 0) {
    out.push({
      id: `${id}:cold-start`,
      severity: 'info',
      nodeId: id,
      title: `${node.label}: ${pct(state.coldFraction)} of traffic on cold instances`,
      detail: `New instances add ${fmtMs(cfg.coldStartMs)} while they warm up.`,
      suggestions: ['Keep warm capacity (higher minimum instances) ahead of predictable spikes.'],
    });
  }
  return out;
}
