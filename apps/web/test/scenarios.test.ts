import { createGoalTracker, createSimulation, hasErrors, validateDesign } from '@syssim/engine';
import type { Design, GoalStatus } from '@syssim/engine';
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../src/features/scenarios';
import { applyDueChaos } from '../src/features/scenarios/chaos';
import type { Scenario } from '../src/features/scenarios/types';

const MAX_SECONDS = 150;

/** Runs a design like the app does (scripted chaos included) until the goal has a verdict. */
function evaluate(scenario: Scenario, design: Design): GoalStatus {
  const sim = createSimulation(design, { samplesPerTick: 60 });
  const tracker = createGoalTracker(scenario.goal);
  const fired = new Set<number>();
  let status = tracker.status();
  for (let i = 0; i < MAX_SECONDS * 10; i++) {
    applyDueChaos(sim, scenario.chaos ?? [], fired);
    status = tracker.observe(sim.step());
    if (status.state !== 'pending') return status;
  }
  return status;
}

describe.each(SCENARIOS)('scenario: $name', (scenario) => {
  it('starts from a valid design', () => {
    expect(hasErrors(validateDesign(scenario.build()))).toBe(false);
  });

  it('starting design misses its goal', () => {
    expect(evaluate(scenario, scenario.build()).state).toBe('fail');
  });

  it('reference solution is valid and meets the goal', () => {
    const solution = scenario.solution();
    expect(hasErrors(validateDesign(solution))).toBe(false);
    const status = evaluate(scenario, solution);
    expect(status.checks).toEqual(status.checks.map((c) => ({ ...c, ok: true })));
    expect(status.state).toBe('pass');
  });

  it('has staged hints', () => {
    expect(scenario.hints.length).toBeGreaterThanOrEqual(3);
  });
});
