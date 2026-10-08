import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { loadScenario } from '../scenarios/loadScenario';
import { exportDesign, importDesign } from './designFile';
import { shareUrl } from './shareLink';

export function PersistenceMenu() {
  const fileInput = useRef<HTMLInputElement>(null);
  const showToast = useUiStore((s) => s.showToast);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const design = await importDesign(file);
      useDesignStore.getState().setDesign(design);
      useUiStore.getState().setScenarioId(null);
      showToast(`Imported "${design.name}"`);
    } catch (error) {
      showToast(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onShare = async () => {
    const url = shareUrl(useDesignStore.getState().design, window.location);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard');
    } catch {
      window.prompt('Copy this share link', url);
    }
  };

  return (
    <div className="topbar-group" role="group" aria-label="Design file">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => loadScenario(null)}
        title="Start a blank design"
      >
        New
      </Button>
      <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
        Import
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={onImport}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => exportDesign(useDesignStore.getState().design)}
      >
        Export
      </Button>
      <Button size="sm" variant="ghost" onClick={onShare}>
        Share link
      </Button>
    </div>
  );
}
