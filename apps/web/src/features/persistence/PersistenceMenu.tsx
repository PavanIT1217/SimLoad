import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Menu, MenuItem } from '../../ui/Menu';
import { downloadMarkdownReport, openPrintableReport } from '../report/reportActions';
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

  // The file input lives outside the popover so it survives the menu closing.
  return (
    <>
      <Menu label="File ▾" align="end" title="New, import, export, share and reports">
        {(close) => {
          const run = (action: () => void) => () => {
            close();
            action();
          };
          return (
            <>
              <MenuItem onClick={run(() => loadScenario(null))}>New blank design</MenuItem>
              <MenuItem
                onClick={run(() => fileInput.current?.click())}
                hint="JSON, Mermaid, draw.io"
              >
                Import…
              </MenuItem>
              <MenuItem onClick={run(() => exportDesign(useDesignStore.getState().design))}>
                Export design
              </MenuItem>
              <hr className="menu-sep" />
              <MenuItem onClick={run(() => void onShare())}>Copy share link</MenuItem>
              <MenuItem onClick={run(downloadMarkdownReport)} hint=".md">
                Download report
              </MenuItem>
              <MenuItem onClick={run(openPrintableReport)}>Printable report (PDF)</MenuItem>
            </>
          );
        }}
      </Menu>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.mmd,.mermaid,.md,.txt,.drawio,.xml"
        hidden
        onChange={onImport}
      />
    </>
  );
}
