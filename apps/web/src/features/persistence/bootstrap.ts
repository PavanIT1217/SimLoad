import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { SCENARIOS } from '../scenarios';
import { loadScenario } from '../scenarios/loadScenario';
import { loadAutosave } from './autosave';
import { designFromHash } from './shareLink';

/**
 * Picks the initial design: a shared link wins, then the autosave, then the
 * first built-in scenario. The hash is cleared so a reload keeps local edits.
 */
export async function bootstrapDesign(): Promise<void> {
  const ui = useUiStore.getState();
  try {
    const shared = await designFromHash(window.location.hash);
    if (shared) {
      useDesignStore.getState().setDesign(shared);
      ui.setScenarioId(null);
      ui.showToast(`Loaded shared design "${shared.name}"`);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
  } catch {
    ui.showToast('The shared link is invalid or corrupted');
  }
  const saved = loadAutosave();
  if (saved && saved.design.nodes.length > 0) {
    useDesignStore.getState().setDesign(saved.design);
    ui.setScenarioId(saved.scenarioId);
    return;
  }
  loadScenario(SCENARIOS[0]?.id ?? null);
}
