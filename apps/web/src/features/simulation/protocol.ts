import type {
  Design,
  Fault,
  FaultKind,
  GoalStatus,
  ScenarioGoal,
  TickResult,
  TrafficSettings,
} from '@syssim/engine';

/** One point on the live charts, aggregated over the ticks of one worker frame. */
export interface ChartPoint {
  /** Simulated time in seconds. */
  t: number;
  offered: number;
  throughput: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  /** Utilisation (0..1+) per node id (saturation, so overload shows above 1). */
  util: Record<string, number>;
}

/** Messages from the UI thread to the simulation worker. */
export type WorkerRequest =
  | { type: 'load'; design: Design; seed: number }
  | { type: 'updateDesign'; design: Design }
  | { type: 'setTraffic'; traffic: TrafficSettings }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step' }
  | { type: 'reset' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'injectFault'; nodeId: string; fault: Fault; durationMs?: number }
  | { type: 'clearFault'; nodeId: string; kind?: FaultKind }
  | { type: 'setGoal'; goal: ScenarioGoal | null };

/** Messages from the simulation worker to the UI thread. */
export type WorkerResponse =
  | {
      type: 'frame';
      tick: TickResult;
      points: ChartPoint[];
      /** Recent traces collected since the previous frame. */
      traces: TickResult['traces'];
      goal: GoalStatus | null;
    }
  | { type: 'status'; running: boolean; ready: boolean }
  | { type: 'reset' }
  | { type: 'error'; message: string };

export const SPEEDS = [1, 2, 5, 10, 25, 50, 100] as const;
/** Real-time interval between worker frames. */
export const FRAME_MS = 50;
