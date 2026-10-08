// Runs the engine off the main thread so the UI stays responsive at any speed.
import { createGoalTracker, createSimulation, estimateCost } from '@syssim/engine';
import type { GoalTracker, Simulation, TickResult } from '@syssim/engine';
import { applyDueChaos } from '../scenarios/chaos';
import type { ScenarioChaos } from '../scenarios/types';
import { toChartPoint } from './aggregate';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { FRAME_MS } from './protocol';

const MAX_TRACES_PER_FRAME = 20;

let sim: Simulation | null = null;
let goal: GoalTracker | null = null;
let chaos: ScenarioChaos[] = [];
const firedChaos = new Set<number>();
let running = false;
let speed = 1;
let carry = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function postStatus(): void {
  post({ type: 'status', running, ready: sim !== null });
}

function fail(error: unknown): void {
  running = false;
  stopTimer();
  post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  postStatus();
}

function emit(ticks: TickResult[]): void {
  const last = ticks[ticks.length - 1];
  const point = toChartPoint(ticks);
  if (!last || !point) return;
  let status = goal?.status() ?? null;
  for (const t of ticks) status = goal?.observe(t) ?? null;
  const traces = ticks
    .slice(-4)
    .flatMap((t) => t.traces)
    .slice(-MAX_TRACES_PER_FRAME);
  post({ type: 'frame', tick: last, points: [point], traces, goal: status });
}

/** Max wall time spent simulating per frame, so the worker never falls behind. */
const FRAME_BUDGET_MS = FRAME_MS * 0.7;

function advance(count: number): void {
  if (!sim || count <= 0) return;
  const ticks: TickResult[] = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    applyDueChaos(sim, chaos, firedChaos);
    ticks.push(sim.step());
    // At high speeds on slow machines, run slower rather than queue up work.
    if (performance.now() - start > FRAME_BUDGET_MS) break;
  }
  emit(ticks);
}

function onFrame(): void {
  if (!sim || !running) return;
  // At 1x one 100 ms tick runs per 100 ms of wall time; speed multiplies that.
  carry += (speed * FRAME_MS) / 100;
  const count = Math.floor(carry);
  carry -= count;
  try {
    advance(count);
  } catch (error) {
    fail(error);
  }
}

function startTimer(): void {
  if (timer === null) timer = setInterval(onFrame, FRAME_MS);
}

function stopTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function handle(msg: WorkerRequest): void {
  switch (msg.type) {
    case 'load':
      sim = createSimulation(msg.design, { seed: msg.seed });
      goal?.reset();
      firedChaos.clear();
      carry = 0;
      post({ type: 'reset' });
      postStatus();
      return;
    case 'updateDesign':
      if (sim) sim.updateDesign(msg.design);
      else sim = createSimulation(msg.design);
      postStatus();
      return;
    case 'setTraffic':
      sim?.setTraffic(msg.traffic);
      return;
    case 'play':
      if (!sim) return;
      running = true;
      startTimer();
      postStatus();
      return;
    case 'pause':
      running = false;
      stopTimer();
      postStatus();
      return;
    case 'step':
      advance(1);
      return;
    case 'reset':
      sim?.reset();
      goal?.reset();
      firedChaos.clear();
      carry = 0;
      post({ type: 'reset' });
      return;
    case 'setSpeed':
      speed = Math.max(0.1, msg.speed);
      return;
    case 'injectFault':
      sim?.injectFault(msg.nodeId, msg.fault, msg.durationMs);
      return;
    case 'clearFault':
      sim?.clearFault(msg.nodeId, msg.kind);
      return;
    case 'setChaos':
      chaos = msg.events;
      firedChaos.clear();
      return;
    case 'setGoal':
      // Budget goals price each tick against the design currently being simulated.
      goal = msg.goal
        ? createGoalTracker(msg.goal, (t) => (sim ? estimateCost(sim.design, t).totalMonthly : 0), {
            latch: msg.latch,
          })
        : null;
      return;
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    handle(event.data);
  } catch (error) {
    if (event.data.type === 'load' || event.data.type === 'updateDesign') sim = null;
    fail(error);
  }
};
