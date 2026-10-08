import type { Design } from '@simload/engine';
import { parseDesignJson } from './schema';
import { readStorage, writeStorage } from './storage';

const AUTOSAVE_KEY = 'simload:design:v1';
const SCENARIO_KEY = 'simload:scenario:v1';

export interface SavedSession {
  design: Design;
  scenarioId: string | null;
}

export function loadAutosave(): SavedSession | null {
  const raw = readStorage(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return { design: parseDesignJson(raw), scenarioId: readStorage(SCENARIO_KEY) || null };
  } catch {
    return null;
  }
}

export function saveAutosave(design: Design, scenarioId: string | null): void {
  writeStorage(AUTOSAVE_KEY, JSON.stringify(design));
  writeStorage(SCENARIO_KEY, scenarioId ?? '');
}

const PREVIOUS_KEY = 'simload:previous:v1';

/** Keeps the user's last own session aside when a fresh visit opens the default scenario. */
export function savePreviousSession(session: SavedSession): void {
  writeStorage(PREVIOUS_KEY, JSON.stringify(session));
}

export function loadPreviousSession(): SavedSession | null {
  const raw = readStorage(PREVIOUS_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { design: unknown; scenarioId: unknown };
    return {
      design: parseDesignJson(JSON.stringify(data.design)),
      scenarioId: typeof data.scenarioId === 'string' ? data.scenarioId : null,
    };
  } catch {
    return null;
  }
}
