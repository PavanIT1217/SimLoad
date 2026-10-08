import { createSimulation } from '@syssim/engine';
import { describe, expect, it } from 'vitest';
import { designSvg } from '../src/features/report/designSvg';
import { buildMarkdownReport } from '../src/features/report/markdownReport';
import { buildHtmlReport } from '../src/features/report/printReport';
import { collectReport } from '../src/features/report/reportData';
import { SCENARIOS } from '../src/features/scenarios';

describe('reports', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'url-shortener') as (typeof SCENARIOS)[number];
  const design = scenario.build();
  const tick = createSimulation(design).run(30);
  const data = collectReport(design, tick, null, scenario);

  it('writes a Markdown review with summary, components and findings', () => {
    const md = buildMarkdownReport(data);
    expect(md).toMatch(/^# URL shortener/);
    expect(md).toMatch(/## Components/);
    expect(md).toMatch(/\| Redirect API \| Service \|/);
    expect(md).toMatch(/### CRITICAL: .*overloaded/);
    expect(md).toMatch(/Scenario goal: .* — PENDING/);
  });

  it('renders a print-ready HTML report with an SVG diagram', () => {
    const html = buildHtmlReport(data);
    expect(html).toMatch(/<svg[^>]*viewBox/);
    expect(html).toContain('Links DB');
    expect(designSvg(design, tick).match(/<rect/g)).toHaveLength(design.nodes.length);
  });
});
