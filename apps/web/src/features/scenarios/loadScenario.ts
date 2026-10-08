import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { findScenario } from './index';

/** Replaces the canvas with a scenario's starting design (or a blank one for null). */
export function loadScenario(id: string | null): void {
  const scenario = findScenario(id);
  const design = scenario
    ? scenario.build()
    : {
        version: 1 as const,
        name: 'Untitled design',
        nodes: [],
        edges: [],
        traffic: { peakRps: 1_000, profile: 'steady' as const, readRatio: 0.9 },
      };
  useDesignStore.getState().setDesign(design);
  useUiStore.getState().setScenarioId(scenario?.id ?? null);
}
