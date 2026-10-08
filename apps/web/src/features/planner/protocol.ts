import type { Design, PlanEvaluation, PlanResult, ScenarioGoal } from '@simload/engine';

export type PlannerRequest = { type: 'plan'; design: Design; goal: ScenarioGoal; seconds: number };

export type PlannerResponse =
  | { type: 'progress'; evaluations: number; phase: 'grow' | 'trim'; latest: PlanEvaluation }
  | { type: 'done'; result: PlanResult }
  | { type: 'error'; message: string };
