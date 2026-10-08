// Runs the capacity search off the main thread (and off the live simulation worker).
import { planCapacity } from '@simload/engine';
import type { PlannerRequest, PlannerResponse } from './protocol';

const post = (message: PlannerResponse) => self.postMessage(message);

self.onmessage = (event: MessageEvent<PlannerRequest>) => {
  const { design, goal, seconds } = event.data;
  try {
    const result = planCapacity(design, goal, {
      seconds,
      maxEvaluations: 60,
      onProgress: (p) => post({ type: 'progress', ...p }),
    });
    post({ type: 'done', result });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
