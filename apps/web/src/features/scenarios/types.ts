import type { Design, ScenarioGoal } from '@syssim/engine';

export interface Scenario {
  id: string;
  name: string;
  summary: string;
  goal: ScenarioGoal;
  /** Nudges shown to the learner; the starting design deliberately misses the goal. */
  hints: string[];
  build(): Design;
}
