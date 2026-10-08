import type { ScenarioGoal } from '../metrics/goals';
import { estimateCost } from '../metrics/cost';
import type { Design, DesignNode, NodeConfig } from '../model/types';
import type { TickResult } from './result';
import { createSimulation } from './simulation';

export type PlanField = 'instances' | 'replicas' | 'shards' | 'consumerRps';

export interface PlanChange {
  nodeId: string;
  label: string;
  field: PlanField;
  from: number;
  to: number;
}

export interface PlanEvaluation {
  pass: boolean;
  p99: number;
  errorRate: number;
  monthlyCost: number;
  bottleneckId: string | null;
  bottleneckRho: number;
}

export interface PlanProgress {
  phase: 'grow' | 'trim';
  evaluations: number;
  latest: PlanEvaluation;
}

export interface PlanResult {
  status: 'already-met' | 'met' | 'unreachable';
  message: string;
  design: Design;
  changes: PlanChange[];
  before: PlanEvaluation;
  after: PlanEvaluation;
  evaluations: number;
}

export interface PlanOptions {
  /** Simulated seconds per evaluation (default 20). */
  seconds?: number;
  /** Max simulations to run (default 60). */
  maxEvaluations?: number;
  seed?: number;
  onProgress?(progress: PlanProgress): void;
}

const GROW_RHO = 0.7;
/** Plans keep at least 10% headroom on every component, even if the goal passes at 100%. */
export const MAX_PLAN_RHO = 0.9;

const acceptable = (e: PlanEvaluation) => e.pass && e.bottleneckRho <= MAX_PLAN_RHO;

function clone(design: Design): Design {
  return JSON.parse(JSON.stringify(design)) as Design;
}

/** Runs the design at the goal's target load and judges it over the second half. */
export function evaluateDesign(
  design: Design,
  goal: ScenarioGoal,
  seconds = 20,
  seed = 42,
): PlanEvaluation {
  const d = clone(design);
  d.traffic = { ...d.traffic, peakRps: goal.targetRps, profile: 'steady' };
  const sim = createSimulation(d, { seed, samplesPerTick: 80, maxTraces: 0 });
  const ticks = Math.max(20, Math.round(seconds * 10));
  let p99 = 0;
  let failed = 0;
  let offered = 0;
  let measured = 0;
  let last: TickResult | null = null;
  for (let i = 0; i < ticks; i++) {
    last = sim.step();
    if (i >= ticks / 2) {
      p99 += last.latency.p99;
      failed += last.offeredRps * last.errorRate;
      offered += last.offeredRps;
      measured++;
    }
  }
  const tick = last as TickResult;
  const bottleneck = Object.values(tick.nodes)
    .filter((n) => n.kind !== 'client')
    .sort((a, b) => b.saturation - a.saturation)[0];
  const errorRate = offered > 0 ? failed / offered : 0;
  const avgP99 = p99 / Math.max(1, measured);
  const monthlyCost = estimateCost(d, tick).totalMonthly;
  return {
    pass: avgP99 < goal.maxP99Ms && errorRate < goal.maxErrorRate,
    p99: avgP99,
    errorRate,
    monthlyCost,
    bottleneckId: bottleneck?.id ?? null,
    bottleneckRho: bottleneck?.saturation ?? 0,
  };
}

/** Picks which knob to turn on an overloaded node, and to what value. */
function growStep(
  node: DesignNode,
  rho: number,
  readShare: number,
): { field: PlanField; to: number } {
  const cfg = node.config;
  const factor = Math.max(1.25, rho / GROW_RHO);
  if (node.kind === 'queue')
    return { field: 'consumerRps', to: Math.ceil(cfg.consumerRps * factor) };
  if (node.kind === 'database') {
    if (readShare > 0.5)
      return {
        field: 'replicas',
        to: Math.max(cfg.replicas + 1, Math.ceil(cfg.replicas * factor)),
      };
    return { field: 'shards', to: Math.max(cfg.shards + 1, Math.ceil(cfg.shards * factor)) };
  }
  return { field: 'instances', to: Math.max(cfg.instances + 1, Math.ceil(cfg.instances * factor)) };
}

function setField(node: DesignNode, field: PlanField, value: number): void {
  const cfg: NodeConfig = node.config;
  cfg[field] = value;
  if (field === 'instances' && cfg.autoscale.enabled) {
    cfg.autoscale = {
      ...cfg.autoscale,
      minInstances: value,
      maxInstances: Math.max(value, cfg.autoscale.maxInstances),
    };
  }
}

/**
 * Finds a cheaper-or-equal configuration that meets `goal`: grow the current
 * bottleneck until the goal passes, then trim each change back while it
 * still passes. Deterministic for a given seed.
 */
export function planCapacity(
  design: Design,
  goal: ScenarioGoal,
  options: PlanOptions = {},
): PlanResult {
  const seconds = options.seconds ?? 20;
  const budget = options.maxEvaluations ?? 60;
  const seed = options.seed ?? 42;
  let evaluations = 0;
  const evaluate = (d: Design, phase: PlanProgress['phase']) => {
    const e = evaluateDesign(d, goal, seconds, seed);
    evaluations++;
    options.onProgress?.({ phase, evaluations, latest: e });
    return e;
  };

  const work = clone(design);
  const before = evaluate(work, 'grow');
  if (acceptable(before)) {
    return {
      status: 'already-met',
      message: 'The design already meets the goal.',
      design: work,
      changes: [],
      before,
      after: before,
      evaluations,
    };
  }
  const original = new Map(design.nodes.map((n) => [n.id, n.config]));
  let current = before;
  while (!acceptable(current) && evaluations < budget) {
    const node = work.nodes.find((n) => n.id === current.bottleneckId);
    if (!node || (current.bottleneckRho < 0.75 && !current.pass)) break;
    const probe = createSimulation({
      ...clone(work),
      traffic: { ...work.traffic, peakRps: goal.targetRps, profile: 'steady' },
    }).run(5);
    const state = probe.nodes[node.id];
    const readShare = state && state.inflowRps > 0 ? state.readRps / state.inflowRps : 0;
    const step = growStep(node, current.bottleneckRho, readShare);
    setField(node, step.field, step.to);
    current = evaluate(work, 'grow');
  }
  if (!acceptable(current)) {
    const latencyBound = current.bottleneckRho < 0.75;
    return {
      status: 'unreachable',
      message: latencyBound
        ? `No component is saturated (max ρ = ${current.bottleneckRho.toFixed(2)}), so more capacity will not help: p99 is ${Math.round(current.p99)} ms from service time, timeouts or dependencies. Cut latency on the critical path (caching, async work, faster dependencies).`
        : `Stopped after ${evaluations} simulations without meeting the goal.`,
      design: work,
      changes: diff(design, work),
      before,
      after: current,
      evaluations,
    };
  }

  // Trim: walk each changed knob back towards its original value while the goal still holds.
  for (const change of diff(design, work)) {
    const node = work.nodes.find((n) => n.id === change.nodeId) as DesignNode;
    const floor = (original.get(node.id) as NodeConfig)[change.field];
    let value = change.to;
    while (evaluations < budget) {
      const next = Math.max(floor, Math.floor(value * 0.85));
      if (next >= value) break;
      setField(node, change.field, next);
      const e = evaluate(work, 'trim');
      if (!acceptable(e)) {
        setField(node, change.field, value);
        break;
      }
      value = next;
      current = e;
    }
  }
  return {
    status: 'met',
    message: `Goal met with ${diff(design, work).length} change(s) after ${evaluations} simulations.`,
    design: work,
    changes: diff(design, work),
    before,
    after: current,
    evaluations,
  };
}

const FIELDS: readonly PlanField[] = ['instances', 'replicas', 'shards', 'consumerRps'];

function diff(from: Design, to: Design): PlanChange[] {
  const changes: PlanChange[] = [];
  for (const node of to.nodes) {
    const was = from.nodes.find((n) => n.id === node.id);
    if (!was) continue;
    for (const field of FIELDS) {
      if (was.config[field] !== node.config[field]) {
        changes.push({
          nodeId: node.id,
          label: node.label,
          field,
          from: was.config[field],
          to: node.config[field],
        });
      }
    }
  }
  return changes;
}
