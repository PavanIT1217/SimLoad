import type { Design } from '../model/types';
import type { TickResult } from '../sim/result';
import type { Insight } from './insights';
import { SEVERITY_RANK, fmt, fmtMs, pct } from './insights';
import { nodeInsights } from './nodeRules';

function cachedAncestors(design: Design): Set<string> {
  const parents = new Map<string, string[]>();
  for (const e of design.edges) parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);
  const kinds = new Map(design.nodes.map((n) => [n.id, n.kind]));
  const memo = new Map<string, boolean>();
  const visit = (id: string, seen: Set<string>): boolean => {
    if (memo.has(id)) return memo.get(id) as boolean;
    if (seen.has(id)) return false;
    seen.add(id);
    const result = (parents.get(id) ?? []).some((p) => {
      const k = kinds.get(p);
      return k === 'cache' || k === 'cdn' || visit(p, seen);
    });
    memo.set(id, result);
    return result;
  };
  return new Set(design.nodes.filter((n) => visit(n.id, new Set())).map((n) => n.id));
}

/**
 * Explains what is limiting the system right now, most severe first, with
 * quantified suggestions. Pure function of the design and one tick.
 */
export function diagnose(design: Design, tick: TickResult | null): Insight[] {
  if (!tick) return [];
  const cached = cachedAncestors(design);
  const insights: Insight[] = [];
  for (const node of design.nodes) {
    const state = tick.nodes[node.id];
    if (!state || node.kind === 'client') continue;
    insights.push(...nodeInsights({ node, state, cachedUpstream: cached.has(node.id) }));
  }

  const zones = new Set(design.nodes.map((n) => n.zone).filter((z): z is string => !!z));
  if (zones.size === 1) {
    insights.push({
      id: 'system:single-zone',
      severity: 'warning',
      title: `Everything runs in zone "${[...zones][0]}"`,
      detail: 'A single zone outage takes the whole system down.',
      suggestions: ['Spread instances across at least two zones and test with "Kill zone".'],
    });
  }

  const bottleneck = Object.values(tick.nodes)
    .filter((s) => s.kind !== 'client')
    .sort((a, b) => b.saturation - a.saturation)[0];
  if (insights.every((i) => i.severity === 'info')) {
    const label = design.nodes.find((n) => n.id === bottleneck?.id)?.label ?? 'none';
    insights.push({
      id: 'system:healthy',
      severity: 'ok',
      title: 'System is healthy',
      detail:
        `Error rate ${pct(tick.errorRate)}, p99 ${fmtMs(tick.latency.p99)} at ${fmt(tick.offeredRps)}/s. ` +
        `Next bottleneck: ${label} at ρ = ${(bottleneck?.saturation ?? 0).toFixed(2)}, ` +
        `so you have about ${fmt(bottleneck && bottleneck.saturation > 0 ? 1 / bottleneck.saturation : 0)}× headroom.`,
      suggestions: ['Raise the load until something turns amber to find the breaking point.'],
    });
  }
  return insights.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (tick.nodes[b.nodeId ?? '']?.saturation ?? 0) - (tick.nodes[a.nodeId ?? '']?.saturation ?? 0),
  );
}
