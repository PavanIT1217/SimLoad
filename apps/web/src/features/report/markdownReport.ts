import type { ReportData } from './reportData';
import { COMPONENT_HEADERS, componentRows, summaryLines } from './reportData';

const cell = (s: string) => s.replace(/\|/g, '\\|');

/** A self-contained Markdown design review. */
export function buildMarkdownReport(data: ReportData): string {
  const { design } = data;
  const lines: string[] = [
    `# ${design.name}`,
    '',
    `_SimLoad report · ${data.generatedAt.toISOString()}_`,
    '',
    '## Summary',
    '',
    ...summaryLines(data).map((l) => `- ${l}`),
    '',
    '## Traffic',
    '',
    `- Peak: ${design.traffic.peakRps.toLocaleString('en-US')} req/s, profile: ${design.traffic.profile}, reads: ${Math.round(design.traffic.readRatio * 100)}%`,
    '',
    '## Components',
    '',
    `| ${COMPONENT_HEADERS.join(' | ')} |`,
    `| ${COMPONENT_HEADERS.map(() => '---').join(' | ')} |`,
    ...componentRows(data).map((r) => `| ${r.map(cell).join(' | ')} |`),
    '',
    '## Connections',
    '',
    ...design.edges.map((e) => {
      const label = (id: string) => design.nodes.find((x) => x.id === id)?.label ?? id;
      const carries = e.traffic && e.traffic !== 'all' ? ` (${e.traffic}s only)` : '';
      return `- ${label(e.source)} → ${label(e.target)}${carries}${e.weight !== 1 ? `, weight ${e.weight}` : ''}`;
    }),
    '',
    '## Findings',
    '',
  ];
  if (data.insights.length === 0) lines.push('_Run the simulation to generate findings._');
  for (const i of data.insights) {
    lines.push(`### ${i.severity.toUpperCase()}: ${i.title}`, '', i.detail, '');
    for (const s of i.suggestions) lines.push(`- ${s}`);
    lines.push('');
  }
  return lines.join('\n');
}
