import { createSimulation } from '@simload/engine';
import { describe, expect, it } from 'vitest';
import { judgeBottleneck } from '../src/app/start/briefing';
import { findScenario } from '../src/features/scenarios';

const shortener = () => {
  const scenario = findScenario('url-shortener');
  if (!scenario) throw new Error('missing scenario');
  return scenario;
};

describe('start-up briefing', () => {
  it('names the first component to crack in the starting design', () => {
    const design = shortener().build();
    const sim = createSimulation(design, { seed: 42 });
    let verdict = null;
    for (let i = 0; i < 400 && !verdict; i++) verdict = judgeBottleneck(sim.step());
    expect(verdict?.nodeId).toBe('db');
  });

  it('reports a held design once enough time has passed', () => {
    const sim = createSimulation(shortener().solution(), { seed: 42 });
    let verdict = null;
    for (let i = 0; i < 400 && !verdict; i++) verdict = judgeBottleneck(sim.step());
    expect(verdict).not.toBeNull();
    expect(verdict?.nodeId).toBeNull();
  });
});
