import { useCallback } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { useTimeout } from '../../ui/useTimeout';

const SHOW_MS = 15_000;

/**
 * Returning visitors start on the default scenario; their own last design is
 * kept and offered here for a while, without getting in the way.
 */
export function RestoreNotice() {
  const startup = useUiStore((s) => s.startup);
  const welcomeOpen = useUiStore((s) => s.welcomeOpen);
  const previous = startup?.previous ?? null;
  const visible = previous !== null && !welcomeOpen;

  const dismiss = useCallback(() => {
    const ui = useUiStore.getState();
    if (ui.startup) ui.setStartup({ ...ui.startup, previous: null });
  }, []);
  useTimeout(visible, SHOW_MS, dismiss);

  if (!visible) return null;
  const restore = () => {
    useDesignStore.getState().setDesign(previous.design);
    const ui = useUiStore.getState();
    ui.setScenarioId(previous.scenarioId);
    ui.showToast(`Restored "${previous.design.name}"`);
    dismiss();
  };
  return (
    <div className="restore-notice" role="status">
      <span>
        Your last design, <strong>{previous.design.name}</strong>, is saved.
      </span>
      <Button size="sm" variant="primary" onClick={restore}>
        Restore
      </Button>
      <button type="button" className="welcome-close" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
