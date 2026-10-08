import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
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

/** Markdown and printable (PDF) design-review reports. */
export function ReportButtons() {
  const showToast = useUiStore((s) => s.showToast);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        title="Download a Markdown report"
        onClick={() => {
          const data = currentReport();
          download(
            buildMarkdownReport(data),
            designFileName(data.design).replace('.syssim.json', '.report.md'),
            'text/markdown',
          );
        }}
      >
        Report
      </Button>
      <Button
        size="sm"
        variant="ghost"
        title="Open a printable report (Save as PDF)"
        onClick={() => {
          if (!printReport(currentReport()))
            showToast('Allow pop-ups to open the printable report');
        }}
      >
        PDF
      </Button>
    </>
  );
}
