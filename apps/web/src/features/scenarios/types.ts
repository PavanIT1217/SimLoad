import type { Design, ScenarioGoal } from '@syssim/engine';

/** A scripted fault that fires during a scenario run (e.g. a zone outage). */
export interface ScenarioChaos {
  /** Simulated second at which the fault starts. */
  atS: number;
  durationS: number;
  /** Kill every node in this zone. */
  zone: string;
  label: string;
}

export type Difficulty = 'warm-up' | 'intermediate' | 'advanced';

export interface Scenario {
  id: string;
  name: string;
  difficulty: Difficulty;
  summary: string;
  goal: ScenarioGoal;
  /** Staged hints: revealed one at a time, and automatically after each failed attempt. */
  hints: string[];
  /** Scripted chaos applied while the scenario runs. */
  chaos?: ScenarioChaos[];
  build(): Design;
  /** A reference design that meets the goal (verified by tests). */
  solution(): Design;
}
