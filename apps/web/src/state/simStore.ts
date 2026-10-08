import type { GoalStatus, RequestTrace, TickResult } from '@syssim/engine';
import { create } from 'zustand';
import type { ChartPoint } from '../features/simulation/protocol';

/** Chart points kept for the live charts. */
export const HISTORY_LIMIT = 300;
/** Sampled request traces kept for the trace viewer. */
export const TRACE_LIMIT = 60;

export interface SimState {
  running: boolean;
  ready: boolean;
  speed: number;
  seed: number;
  /** Latest tick: drives the canvas and live readouts (updated once per animation frame). */
  latest: TickResult | null;
  /** Chart history and traces: throttled separately because charts are expensive to redraw. */
  history: ChartPoint[];
  traces: RequestTrace[];
  goal: GoalStatus | null;
  error: string | null;
  /** Index into `history` being replayed on the canvas, or null for live. */
  replayIndex: number | null;
  setReplayIndex(index: number | null): void;
  applyLive(tick: TickResult, goal: GoalStatus | null): void;
  applyCharts(points: ChartPoint[], traces: RequestTrace[]): void;
  setStatus(running: boolean, ready: boolean): void;
  setSpeed(speed: number): void;
  setSeed(seed: number): void;
  setError(error: string | null): void;
  clearResults(): void;
}

export const useSimStore = create<SimState>()((set) => ({
  running: false,
  ready: false,
  speed: 1,
  seed: 42,
  latest: null,
  history: [],
  traces: [],
  goal: null,
  error: null,
  replayIndex: null,
  setReplayIndex: (replayIndex) => set({ replayIndex }),
  applyLive: (latest, goal) => set({ latest, goal, error: null, replayIndex: null }),
  applyCharts: (points, traces) =>
    set((s) => ({
      history: points.length ? [...s.history, ...points].slice(-HISTORY_LIMIT) : s.history,
      traces: traces.length ? [...s.traces, ...traces].slice(-TRACE_LIMIT) : s.traces,
    })),
  setStatus: (running, ready) => set({ running, ready }),
  setSpeed: (speed) => set({ speed }),
  setSeed: (seed) => set({ seed }),
  setError: (error) => set({ error }),
  clearResults: () => set({ latest: null, history: [], traces: [], goal: null, replayIndex: null }),
}));
