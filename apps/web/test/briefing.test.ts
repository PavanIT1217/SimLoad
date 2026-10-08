import { createSimulation } from '@simload/engine';
import { describe, expect, it } from 'vitest';
import { judgeBottleneck, preflightLines } from '../src/app/start/briefing';
import { findScenario } from '../src/features/scenarios';

const shortener = () => {
  const scenario = findScenario('url-shortener');
  if (!scenario) throw new Error('missing scenario');
  return scenario;
};

describe('start-up briefing', () => {
  it('writes the pre-flight checklist from the design', () => {
    const lines = preflightLines(shortener().build());
    expect(lines[0]).toMatch(/^Compiling \d+ components and \d+ connections$/);
    expect(lines[1]).toContain('Edge LB');
    expect(lines[2]).toBe('Mixing traffic: 99% reads, 1% writes');
  });

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
