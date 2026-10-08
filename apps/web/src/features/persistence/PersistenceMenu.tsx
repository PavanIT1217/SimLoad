import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { ReportButtons } from '../report/ReportButtons';
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
    const pending = shareUrl(useDesignStore.getState().design, window.location);
    try {
      // Start the clipboard write inside the click (user activation) and resolve the
      // compressed URL later; fall back to writeText where ClipboardItem is missing.
      if (typeof ClipboardItem !== 'undefined') {
        const blob = pending.then((url) => new Blob([url], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      } else {
        await navigator.clipboard.writeText(await pending);
      }
      showToast(`Share link copied (${(await pending).length.toLocaleString()} characters)`);
    } catch {
      window.prompt('Copy this share link', await pending);
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
        accept=".json,.mmd,.mermaid,.md,.txt,.drawio,.xml"
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
      <ReportButtons />
    </div>
  );
}
