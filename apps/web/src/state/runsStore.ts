import { create } from 'zustand';
import type { ChartPoint } from '../features/simulation/protocol';
import { readStorage, writeStorage } from '../features/persistence/storage';

export const MAX_RUNS = 4;
const STORAGE_KEY = 'simload:runs:v1';

export interface RunPoint {
  /** Seconds since the start of the recording. */
  t: number;
  p50: number;
  p95: number;
  p99: number;
  offered: number;
  throughput: number;
  errorRate: number;
}

export interface RunSummary {
  p99: number;
  errorRate: number;
  throughput: number;
  durationS: number;
}

export interface SavedRun {
  id: string;
  label: string;
  createdAt: number;
  visible: boolean;
  points: RunPoint[];
  summary: RunSummary;
}

/** Converts live chart history into a compact, time-aligned run. */
export function toRunPoints(history: readonly ChartPoint[]): RunPoint[] {
  const t0 = history[0]?.t ?? 0;
  return history.map((p) => ({
    t: +(p.t - t0).toFixed(2),
    p50: p.p50,
    p95: p.p95,
    p99: p.p99,
    offered: p.offered,
    throughput: p.throughput,
    errorRate: p.errorRate,
  }));
}

/** Steady-state summary over the last 30% of the run. */
export function summarizeRun(points: readonly RunPoint[]): RunSummary {
  const tail = points.slice(Math.floor(points.length * 0.7));
  const avg = (f: (p: RunPoint) => number) =>
    tail.length > 0 ? tail.reduce((s, p) => s + f(p), 0) / tail.length : 0;
  return {
    p99: avg((p) => p.p99),
    errorRate: avg((p) => p.errorRate),
    throughput: avg((p) => p.throughput),
    durationS: points[points.length - 1]?.t ?? 0,
  };
}

interface RunsState {
  runs: SavedRun[];
  save(label: string, history: readonly ChartPoint[]): void;
  remove(id: string): void;
  toggle(id: string): void;
}

function load(): SavedRun[] {
  try {
    const raw = readStorage(STORAGE_KEY);
    const runs = raw ? (JSON.parse(raw) as SavedRun[]) : [];
    return Array.isArray(runs) ? runs.slice(-MAX_RUNS) : [];
  } catch {
    return [];
  }
}

export const useRunsStore = create<RunsState>()((set, get) => {
  const persist = () => writeStorage(STORAGE_KEY, JSON.stringify(get().runs));
  return {
    runs: load(),
    save: (label, history) => {
      const points = toRunPoints(history);
      const run: SavedRun = {
        id: `run-${Date.now().toString(36)}`,
        label,
        createdAt: Date.now(),
        visible: true,
        points,
        summary: summarizeRun(points),
      };
      set((s) => ({ runs: [...s.runs, run].slice(-MAX_RUNS) }));
      persist();
    },
    remove: (id) => {
      set((s) => ({ runs: s.runs.filter((r) => r.id !== id) }));
      persist();
    },
    toggle: (id) => {
      set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)) }));
      persist();
    },
  };
});
