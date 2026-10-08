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
    simulation.setGoal(mode === 'prep' && scenario ? scenario.goal : null);
  }, [scenarioId, mode]);
}
