import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { designFileName } from '../persistence/designFile';
import { findScenario } from '../scenarios';
import { buildMarkdownReport } from './markdownReport';
import { printReport } from './printReport';
import { collectReport } from './reportData';

function currentReport() {
  const { design } = useDesignStore.getState();
  const { latest, goal } = useSimStore.getState();
  return collectReport(design, latest, goal, findScenario(useUiStore.getState().scenarioId));
}

function download(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Downloads the design-review report as Markdown. */
export function downloadMarkdownReport(): void {
  const data = currentReport();
  download(
    buildMarkdownReport(data),
    designFileName(data.design).replace('.simload.json', '.report.md'),
    'text/markdown',
  );
}

/** Opens the printable report (Save as PDF), or explains that pop-ups are blocked. */
export function openPrintableReport(): void {
  if (!printReport(currentReport()))
    useUiStore.getState().showToast('Allow pop-ups to open the printable report');
}
