import { useUiStore } from '../../state/uiStore';
import { SCENARIOS } from './index';
import { loadScenario } from './loadScenario';
import type { Difficulty } from './types';

const DIFFICULTIES: readonly Difficulty[] = ['warm-up', 'intermediate', 'advanced'];

export function ScenarioPicker() {
  const scenarioId = useUiStore((s) => s.scenarioId);
  return (
    <label className="topbar-field">
      <span className="topbar-label">Scenario</span>
      <select
        className="input"
        value={scenarioId ?? ''}
        onChange={(e) => loadScenario(e.target.value || null)}
      >
        <option value="">Free design</option>
        {DIFFICULTIES.map((d) => (
          <optgroup key={d} label={d}>
            {SCENARIOS.filter((s) => s.difficulty === d).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
