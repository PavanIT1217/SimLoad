import type { Design } from '@simload/engine';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { findScenario } from '../scenarios';
import { loadScenario } from '../scenarios/loadScenario';
import type { SavedSession } from './autosave';
import { loadAutosave, loadPreviousSession, savePreviousSession } from './autosave';
import { designFromHash } from './shareLink';

/** Scenario every fresh visit starts with. */
export const DEFAULT_SCENARIO_ID = 'url-shortener';

/** What the start-up overlay announces before the simulation begins. */
export interface StartupInfo {
  kind: 'scenario' | 'shared';
  title: string;
  detail: string;
  /** The visitor's own earlier work, offered as "Restore" (null if there is none). */
  previous: SavedSession | null;
}

const sameDesign = (a: Design, b: Design) =>
  JSON.stringify({ ...a, name: '' }) === JSON.stringify({ ...b, name: '' });

/**
 * Picks the initial design. A shared link opens that design; otherwise every
 * visit starts with the URL shortener scenario. The visitor's autosaved work
 * is kept aside (not discarded) and offered as "Restore". The hash is cleared
 * so a reload does not re-import the shared design over local edits.
 */
export async function bootstrapDesign(): Promise<StartupInfo> {
  const ui = useUiStore.getState();
  try {
    const shared = await designFromHash(window.location.hash);
    if (shared) {
      useDesignStore.getState().setDesign(shared);
      ui.setScenarioId(null);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return { kind: 'shared', title: shared.name, detail: 'Shared design', previous: null };
    }
  } catch {
    ui.showToast('The shared link is invalid or corrupted');
  }

  const scenario = findScenario(DEFAULT_SCENARIO_ID);
  const saved = loadAutosave();
  const isOwnWork =
    saved !== null &&
    saved.design.nodes.length > 0 &&
    !(scenario && saved.scenarioId === scenario.id && sameDesign(saved.design, scenario.build()));
  if (saved && isOwnWork) savePreviousSession(saved);
  const previous = isOwnWork ? saved : loadPreviousSession();

  loadScenario(scenario?.id ?? null);
  return {
    kind: 'scenario',
    title: scenario?.name ?? 'New design',
    detail: scenario?.summary ?? '',
    previous,
  };
}
