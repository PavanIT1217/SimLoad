import { useUiStore } from '../../state/uiStore';
import { SCENARIOS } from './index';
import { loadScenario } from './loadScenario';

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
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
