import { compileGraph } from '../model/graph';
import type { CompiledGraph } from '../model/graph';
import { DEFAULT_OPTIONS } from '../model/defaults';
import type { Design, Fault, FaultKind, SimulationOptions, TrafficSettings } from '../model/types';
import { validateDesign } from '../model/validation';
import { SampleWindow } from '../metrics/window';
import { offeredRps } from '../traffic/profiles';
import { createRng } from '../util/rng';
import type { Rng } from '../util/rng';
import { applyPendingScale, evaluateAutoscale } from './autoscale';
import { forwardPass } from './flow';
import { backwardPass } from './propagation';
import type { TickResult } from './result';
import { buildNodeState, selectTraces, systemTotals } from './result';
import { sampleRequests } from './sampler';
import type { NodeRuntime } from './state';
import { createNodeRuntime, expireFaults } from './state';

/** Seconds for a flushed cache to warm back up to its configured hit ratio. */
export const CACHE_WARMUP_S = 20;

export interface Simulation {
  /** Advances the simulation by one tick. */
  step(): TickResult;
  /** Advances `ticks` ticks and returns the last result. */
  run(ticks: number): TickResult;
  setTraffic(traffic: Partial<TrafficSettings>): void;
  injectFault(nodeId: string, fault: Fault, durationMs?: number): void;
  clearFault(nodeId: string, kind?: FaultKind): void;
  /** Swaps in an edited design, keeping state for nodes that still exist. */
  updateDesign(design: Design): void;
  /** Restarts from t = 0 with fresh state and the original seed. */
  reset(): void;
  readonly timeMs: number;
  readonly design: Design;
}

export class DesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignError';
  }
}

function assertValid(design: Design): CompiledGraph {
  const errors = validateDesign(design).filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new DesignError(errors.map((e) => e.message).join('; '));
  }
  return compileGraph(design);
}

export function createSimulation(
  initialDesign: Design,
  options: Partial<SimulationOptions> = {},
): Simulation {
  const opts: SimulationOptions = { ...DEFAULT_OPTIONS, ...options };
  const dtS = opts.tickMs / 1000;
  let design = initialDesign;
  let traffic: TrafficSettings = { ...initialDesign.traffic };
  let graph = assertValid(design);
  let runtimes = new Map<string, NodeRuntime>();
  let rng: Rng = createRng(opts.seed);
  let tick = 0;
  let nextTraceId = 0;
  const window = new SampleWindow(opts.percentileWindowTicks);

  const syncRuntimes = (): void => {
    const next = new Map<string, NodeRuntime>();
    for (const node of design.nodes) {
      const existing = runtimes.get(node.id);
      if (existing && !node.config.autoscale.enabled) {
        existing.instances = Math.max(1, Math.floor(node.config.instances));
      }
      next.set(node.id, existing ?? createNodeRuntime(node));
    }
    runtimes = next;
  };

  const reset = (): void => {
    runtimes = new Map();
    syncRuntimes();
    rng = createRng(opts.seed);
    tick = 0;
    nextTraceId = 0;
    window.clear();
  };
  reset();

  const step = (): TickResult => {
    const timeMs = tick * opts.tickMs;
    for (const runtime of runtimes.values()) {
      expireFaults(runtime, timeMs);
      applyPendingScale(runtime, timeMs);
    }

    const offered = offeredRps(traffic, timeMs / 1000);
    const perClient = graph.clients.length > 0 ? offered / graph.clients.length : 0;
    const readRatio = Math.min(1, Math.max(0, traffic.readRatio));
    const clientRates = { read: perClient * readRatio, write: perClient * (1 - readRatio) };

    const flows = forwardPass(graph, runtimes, clientRates, dtS);
    const outcomes = backwardPass(graph, flows, runtimes);

    const samples = sampleRequests(
      graph,
      flows,
      rng,
      offered > 0 ? opts.samplesPerTick : 0,
      readRatio,
      nextTraceId,
    );
    nextTraceId += samples.length;
    window.push(samples.map((s) => s.latencyMs));

    const nodes: TickResult['nodes'] = {};
    for (const id of graph.order) {
      const flow = flows.nodes.get(id);
      const outcome = outcomes.get(id);
      const runtime = runtimes.get(id) as NodeRuntime;
      if (!flow || !outcome) continue;
      nodes[id] = buildNodeState(flow, outcome, runtime);
      evaluateAutoscale(flow.node, runtime, flow.inflow.read + flow.inflow.write, timeMs);
      runtime.cacheWarmth = Math.min(1, runtime.cacheWarmth + dtS / CACHE_WARMUP_S);
    }

    const totals = systemTotals(graph, flows, outcomes, offered);
    const failedSamples = samples.filter((s) => !s.ok).length;
    tick++;
    return {
      tick,
      timeMs: tick * opts.tickMs,
      offeredRps: offered,
      ...totals,
      sampledErrorRate: samples.length > 0 ? failedSamples / samples.length : 0,
      latency: window.summary(),
      nodes,
      edges: Object.fromEntries(flows.edges),
      traces: selectTraces(samples, opts.maxTraces),
    };
  };

  return {
    step,
    run(ticks) {
      let last = step();
      for (let i = 1; i < ticks; i++) last = step();
      return last;
    },
    setTraffic(next) {
      traffic = { ...traffic, ...next };
    },
    injectFault(nodeId, fault, durationMs) {
      const runtime = runtimes.get(nodeId);
      if (!runtime) return;
      if (fault.kind === 'flushCache') {
        runtime.cacheWarmth = 0;
        return;
      }
      const untilMs = durationMs !== undefined ? tick * opts.tickMs + durationMs : null;
      runtime.faults.set(fault.kind, { fault, untilMs });
    },
    clearFault(nodeId, kind) {
      const runtime = runtimes.get(nodeId);
      if (!runtime) return;
      if (kind) runtime.faults.delete(kind);
      else runtime.faults.clear();
    },
    updateDesign(next) {
      graph = assertValid(next);
      design = next;
      traffic = { ...next.traffic };
      syncRuntimes();
    },
    reset,
    get timeMs() {
      return tick * opts.tickMs;
    },
    get design() {
      return design;
    },
  };
}
