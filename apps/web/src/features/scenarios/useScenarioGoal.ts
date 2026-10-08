import { useEffect } from 'react';
import { useUiStore } from '../../state/uiStore';
import { simulation } from '../simulation/client';
import { findScenario } from './index';

/** Tells the worker which goal to track: the active scenario's, in prep mode only. */
export function useScenarioGoal(): void {
  const scenarioId = useUiStore((s) => s.scenarioId);
  const mode = useUiStore((s) => s.mode);
  useEffect(() => {
    const scenario = findScenario(scenarioId);
    const active = mode === 'prep' && scenario;
    // With scripted chaos the outage is the test: keep the verdict until Reset.
    simulation.setGoal(active ? scenario.goal : null, !!active && !!scenario.chaos?.length);
    simulation.setChaos(active ? (scenario.chaos ?? []) : []);
  }, [scenarioId, mode]);
}
