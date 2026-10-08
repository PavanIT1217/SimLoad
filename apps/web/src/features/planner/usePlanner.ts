import type { Design, PlanEvaluation, PlanResult, ScenarioGoal } from '@simload/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlannerResponse } from './protocol';

export interface PlannerState {
  running: boolean;
  evaluations: number;
  phase: 'grow' | 'trim' | null;
  latest: PlanEvaluation | null;
  result: PlanResult | null;
  error: string | null;
}

const IDLE: PlannerState = {
  running: false,
  evaluations: 0,
  phase: null,
  latest: null,
  result: null,
  error: null,
};

/** Starts and cancels planner runs in a dedicated worker. */
export function usePlanner() {
  const [state, setState] = useState<PlannerState>(IDLE);
  const worker = useRef<Worker | null>(null);

  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  useEffect(() => () => worker.current?.terminate(), []);

  const start = useCallback(
    (design: Design, goal: ScenarioGoal) => {
      stop();
      const w = new Worker(new URL('./planner.worker.ts', import.meta.url), {
        type: 'module',
        name: 'planner',
      });
      worker.current = w;
      setState({ ...IDLE, running: true });
      w.onmessage = (event: MessageEvent<PlannerResponse>) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          setState((s) => ({
            ...s,
            evaluations: msg.evaluations,
            phase: msg.phase,
            latest: msg.latest,
          }));
        } else {
          setState((s) => ({
            ...s,
            running: false,
            result: msg.type === 'done' ? msg.result : null,
            error: msg.type === 'error' ? msg.message : null,
          }));
          w.terminate();
          worker.current = null;
        }
      };
      w.postMessage({ type: 'plan', design, goal, seconds: 15 });
    },
    [stop],
  );

  return { state, start, stop };
}
