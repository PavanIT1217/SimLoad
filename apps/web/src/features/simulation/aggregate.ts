import type { TickResult } from '@syssim/engine';
import type { ChartPoint, NodeSnapshot } from './protocol';

/** Averages a batch of ticks into one chart point. */
export function toChartPoint(ticks: readonly TickResult[]): ChartPoint | null {
  const last = ticks[ticks.length - 1];
  if (!last) return null;
  const n = ticks.length;
  let offered = 0;
  let throughput = 0;
  let failed = 0;
  const util: Record<string, number> = {};
  for (const t of ticks) {
    offered += t.offeredRps;
    throughput += t.throughputRps;
    failed += t.offeredRps * t.errorRate;
    for (const [id, node] of Object.entries(t.nodes)) {
      if (node.kind === 'client') continue;
      util[id] = (util[id] ?? 0) + node.saturation / n;
    }
  }
  return {
    t: last.timeMs / 1000,
    offered: offered / n,
    throughput: throughput / n,
    errorRate: offered > 0 ? failed / offered : 0,
    p50: last.latency.p50,
    p95: last.latency.p95,
    p99: last.latency.p99,
    util,
    nodes: snapshot(last),
  };
}

function snapshot(tick: TickResult): Record<string, NodeSnapshot> {
  const out: Record<string, NodeSnapshot> = {};
  for (const [id, n] of Object.entries(tick.nodes)) {
    out[id] = {
      i: n.inflowRps,
      s: n.saturation,
      q: n.queueDepth,
      w: n.latencyMs,
      n: n.instances,
      f: n.failed ? 1 : 0,
      ok: n.successRate,
    };
  }
  return out;
}
