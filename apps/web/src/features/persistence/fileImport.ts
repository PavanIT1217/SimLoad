import type { Design } from '@simload/engine';
import { autoLayout } from '../canvas/autoLayout';
import { diagramToDesign, parseDrawio, parseMermaid } from './diagramImport';
import { parseDesignJson } from './schema';

export type ImportFormat = 'json' | 'mermaid' | 'drawio';

/** Detects the file type from its content. */
export function detectFormat(text: string): ImportFormat {
  const t = text.trimStart();
  if (t.startsWith('{')) return 'json';
  if (/<mxfile|<mxGraphModel/.test(t)) return 'drawio';
  return 'mermaid';
}

/**
 * Imports a design from SimLoad JSON, a Mermaid flowchart or a draw.io file.
 * Diagram imports get default component settings and an automatic layout
 * (draw.io keeps its own positions when it has them).
 */
export async function importDesignFile(
  text: string,
  fileName: string,
): Promise<{ design: Design; format: ImportFormat }> {
  const format = detectFormat(text);
  if (format === 'json') return { design: parseDesignJson(text), format };
  const name = fileName.replace(/\.[^.]+$/, '') || 'Imported diagram';
  const graph = format === 'drawio' ? await parseDrawio(text) : parseMermaid(text);
  const design = diagramToDesign(graph, name);
  const hasPositions = format === 'drawio' && graph.nodes.every((n) => Number.isFinite(n.x));
  if (!hasPositions) {
    const positions = autoLayout(design);
    design.nodes = design.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position }));
  }
  return { design, format };
}
