import { designSvg } from './designSvg';
import type { ReportData } from './reportData';
import { COMPONENT_HEADERS, componentRows, descriptionLines, summaryLines } from './reportData';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STYLES = `
  body { font: 13px/1.5 system-ui, sans-serif; color: #0f172a; max-width: 960px; margin: 24px auto; padding: 0 24px; }
  h1 { margin: 0 0 4px; } h2 { margin: 24px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .meta { color: #64748b; } table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: right; }
  th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
  .finding { border-left: 3px solid #0e7490; padding: 4px 10px; margin: 8px 0; break-inside: avoid; }
  .critical { border-color: #dc2626; } .warning { border-color: #d97706; } .ok { border-color: #059669; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .charts figure { margin: 0; break-inside: avoid; } .charts svg { width: 100%; height: auto; }
  .diagram { break-inside: avoid; }
  @media print { body { margin: 0; } button { display: none; } }
`;

/** Collects the live chart SVGs from the page so the report shows the same curves. */
function chartFigures(): string {
  const cards = [...document.querySelectorAll<HTMLElement>('.metrics .chart-card')];
  return cards
    .map((card) => {
      const svg = card.querySelector('svg.recharts-surface');
      const title = card.querySelector('.chart-card-header span')?.textContent ?? '';
      return svg
        ? `<figure><figcaption><strong>${esc(title)}</strong></figcaption>${svg.outerHTML}</figure>`
        : '';
    })
    .join('');
}

export function buildHtmlReport(data: ReportData, charts = ''): string {
  const rows = componentRows(data)
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  const findings = data.insights
    .map(
      (i) =>
        `<div class="finding ${i.severity}"><strong>${esc(i.title)}</strong><br>${esc(i.detail)}` +
        `${i.suggestions.length ? `<ul>${i.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}</div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.design.name)} — report</title><style>${STYLES}</style></head><body>
<h1>${esc(data.design.name)}</h1><div class="meta">SimLoad · ${data.generatedAt.toLocaleString()}</div>
<h2>Summary</h2><ul>${summaryLines(data)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')}</ul>
<h2>Architecture</h2><div class="diagram">${designSvg(data.design, data.tick)}</div>
<h2>Components</h2><table><thead><tr>${COMPONENT_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
${
  descriptionLines(data).length
    ? `<h2>What each part does</h2><ul>${descriptionLines(data)
        .map((l) => `<li>${esc(l)}</li>`)
        .join('')}</ul>`
    : ''
}
${charts ? `<h2>Live metrics</h2><div class="charts">${charts}</div>` : ''}
<h2>Findings</h2>${findings || '<p>Run the simulation to generate findings.</p>'}
</body></html>`;
}

/** Opens the report in a new window and invokes the print dialog (Save as PDF). */
export function printReport(data: ReportData): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildHtmlReport(data, chartFigures()));
  win.document.close();
  win.addEventListener('load', () => win.print());
  setTimeout(() => win.print(), 400);
  return true;
}
