import { describeGoal, diagnose, estimateCost, KIND_LABELS } from '@simload/engine';
import type { CostBreakdown, Design, GoalStatus, Insight, TickResult } from '@simload/engine';
import type { Scenario } from '../scenarios/types';

export interface ReportData {
  design: Design;
  tick: TickResult | null;
  insights: Insight[];
  cost: CostBreakdown;
  goal: GoalStatus | null;
  scenario: Scenario | undefined;
  generatedAt: Date;
}

export function collectReport(
  design: Design,
  tick: TickResult | null,
  goal: GoalStatus | null,
  scenario: Scenario | undefined,
): ReportData {
  return {
    design,
    tick,
    insights: diagnose(design, tick),
    cost: estimateCost(design, tick),
    goal,
    scenario,
    generatedAt: new Date(),
  };
}

const n = (v: number) =>
  Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : `${+v.toFixed(2)}`;
const ms = (v: number) => `${+v.toFixed(1)} ms`;
const pct = (v: number) => `${+(v * 100).toFixed(3)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

/** Rows of the component table shared by the Markdown and HTML reports. */
export function componentRows(data: ReportData): string[][] {
  return data.design.nodes.map((node) => {
    const live = data.tick?.nodes[node.id];
    const cost = data.cost.nodes.find((c) => c.nodeId === node.id);
    return [
      node.label,
      KIND_LABELS[node.kind],
      `${live?.instances ?? node.config.instances}`,
      live ? `${n(live.inflowRps)}/s` : '–',
      live && node.kind !== 'client' ? `${n(live.saturation * 100)}%` : '–',
      live ? ms(live.latencyMs) : '–',
      cost ? usd(cost.monthly) : '–',
    ];
  });
}

export const COMPONENT_HEADERS = [
  'Component',
  'Kind',
  'Instances',
  'Inflow',
  'ρ',
  'Latency',
  '$/month',
];

/** Summary lines: load, latency, errors, cost and goal verdict. */
export function summaryLines(data: ReportData): string[] {
  const t = data.tick;
  const lines = t
    ? [
        `Offered load: ${n(t.offeredRps)} req/s (goodput ${n(t.throughputRps)} req/s)`,
        `Latency: p50 ${ms(t.latency.p50)} · p95 ${ms(t.latency.p95)} · p99 ${ms(t.latency.p99)}`,
        `Error rate: ${pct(t.errorRate)} · retry traffic ${n(t.retryRps)} req/s`,
        `Simulated time: ${(t.timeMs / 1000).toFixed(1)} s`,
      ]
    : ['The simulation has not been run yet.'];
  lines.push(
    `Estimated cost: ${usd(data.cost.totalMonthly)}/month (fixed ${usd(data.cost.fixedMonthly)} + usage ${usd(data.cost.usageMonthly)})`,
  );
  if (data.scenario) {
    lines.push(
      `Scenario goal: ${describeGoal(data.scenario.goal)} — ${(data.goal?.state ?? 'pending').toUpperCase()}`,
    );
  }
  return lines;
}

/** "Label: description" lines for every described component and connection. */
export function descriptionLines(data: ReportData): string[] {
  const label = (id: string) => data.design.nodes.find((n) => n.id === id)?.label ?? id;
  return [
    ...data.design.nodes.filter((n) => n.description).map((n) => `${n.label}: ${n.description}`),
    ...data.design.edges
      .filter((e) => e.description)
      .map((e) => `${label(e.source)} → ${label(e.target)}: ${e.description}`),
  ];
}
