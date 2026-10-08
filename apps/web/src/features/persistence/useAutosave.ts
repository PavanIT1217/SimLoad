import { useEffect } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { saveAutosave } from './autosave';

const AUTOSAVE_DELAY_MS = 500;

/** Debounced autosave of the current design to localStorage. */
export function useAutosave(): void {
  const design = useDesignStore((s) => s.design);
  const scenarioId = useUiStore((s) => s.scenarioId);
  useEffect(() => {
    const timer = setTimeout(() => saveAutosave(design, scenarioId), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [design, scenarioId]);
}
