import { createDesign, createEdge, createNode } from '@simload/engine';
import type { ComponentKind, Design, DesignEdge, DesignNode } from '@simload/engine';
import { inferKind } from './kindInference';
import { DesignParseError } from './schema';

export interface DiagramNode {
  id: string;
  label: string;
  kind: ComponentKind;
  x?: number;
  y?: number;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: { source: string; target: string }[];
}

// ---------------- Mermaid ----------------

/** id followed by an optional shape: A[x], A(x), A[(x)], A((x)), A{x}, A{{x}}, A>x], A[/x/]. */
const MERMAID_NODE =
  /([A-Za-z0-9_.-]+)\s*(\[\(|\(\(|\[\[|\{\{|\[\/|\[|\(|\{|>)?\s*("?)([^\])}"]*?)\3\s*(\)\]|\)\)|\]\]|\}\}|\/\]|\]|\)|\})?\s*$/;
const MERMAID_ARROW = /\s*(?:-->|---|==>|-\.->|--[ox]|<-->)\s*(?:\|[^|]*\|\s*)?/;

function parseMermaidNode(token: string, nodes: Map<string, DiagramNode>): string | null {
  const m = MERMAID_NODE.exec(token.trim());
  if (!m || !m[1]) return null;
  const [, id, open = '', , text = ''] = m;
  const existing = nodes.get(id);
  const label = text.trim() || existing?.label || id;
  if (!existing || text.trim()) {
    nodes.set(id, { id, label, kind: inferKind(label, open === '[(' ? 'cylinder' : '') });
  }
  return id;
}

/** Parses Mermaid `graph` / `flowchart` definitions (nodes, shapes, chained arrows). */
export function parseMermaid(text: string): DiagramGraph {
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramGraph['edges'] = [];
  for (const raw of text.split(/\n|;/)) {
    const line = raw.replace(/%%.*$/, '').trim();
    if (
      !line ||
      /^(graph|flowchart|subgraph|end|classDef|class|style|linkStyle|click|direction)\b/.test(line)
    ) {
      continue;
    }
    const parts = line.split(MERMAID_ARROW).filter((p) => p.trim() !== '');
    const ids = parts.map((p) => parseMermaidNode(p, nodes));
    for (let i = 0; i + 1 < ids.length; i++) {
      const [a, b] = [ids[i], ids[i + 1]];
      if (a && b && line.match(MERMAID_ARROW)) edges.push({ source: a, target: b });
    }
  }
  return { nodes: [...nodes.values()], edges };
}

// ---------------- draw.io ----------------

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** draw.io labels are HTML inside an XML attribute, so entities are encoded twice. */
function decodeLabel(s: string): string {
  return decodeEntities(decodeEntities(s));
}

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Inflates the compressed payload draw.io stores inside <diagram> (base64 → raw deflate → URI-encoded XML). */
export async function inflateDrawio(payload: string): Promise<string> {
  const bytes = Uint8Array.from(atob(payload.trim()), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return decodeURIComponent(await new Response(stream).text());
}

/** Parses mxGraph XML (uncompressed). Vertices become nodes, edges keep their source/target. */
export function parseMxGraph(xml: string): DiagramGraph {
  const nodes: DiagramNode[] = [];
  const edges: DiagramGraph['edges'] = [];
  const cell = /<(mxCell|object|UserObject)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  for (let m = cell.exec(xml); m; m = cell.exec(xml)) {
    const own = m[2] ?? '';
    const inner = m[4] ?? '';
    const tag = m[1] === 'mxCell' ? own : `${own} ${/<mxCell\b([^>]*)/.exec(inner)?.[1] ?? ''}`;
    const id = attr(own, 'id');
    if (!id) continue;
    if (attr(tag, 'edge') === '1') {
      const source = attr(tag, 'source');
      const target = attr(tag, 'target');
      if (source && target) edges.push({ source, target });
    } else if (attr(tag, 'vertex') === '1') {
      const label = decodeLabel(attr(own, 'label') ?? attr(own, 'value') ?? '') || id;
      const geometry = /<mxGeometry\b([^>]*)/.exec(inner)?.[1] ?? '';
      nodes.push({
        id,
        label,
        kind: inferKind(label, attr(tag, 'style') ?? ''),
        x: Number(attr(geometry, 'x') ?? NaN),
        y: Number(attr(geometry, 'y') ?? NaN),
      });
    }
  }
  const known = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => known.has(e.source) && known.has(e.target)) };
}

export async function parseDrawio(text: string): Promise<DiagramGraph> {
  const diagram = /<diagram\b[^>]*>([\s\S]*?)<\/diagram>/.exec(text)?.[1]?.trim();
  if (diagram && !diagram.startsWith('<')) return parseMxGraph(await inflateDrawio(diagram));
  return parseMxGraph(text);
}

// ---------------- to Design ----------------

/** Turns a parsed diagram into a design; adds a client if the diagram has none. */
export function diagramToDesign(graph: DiagramGraph, name: string): Design {
  if (graph.nodes.length === 0) throw new DesignParseError('No components found in the diagram');
  const ids = new Map<string, string>();
  const used = new Set<string>();
  const nodes: DesignNode[] = graph.nodes.map((n, i) => {
    let id = n.id.replace(/[^A-Za-z0-9_-]/g, '-') || `node-${i}`;
    while (used.has(id)) id = `${id}-${i}`;
    used.add(id);
    ids.set(n.id, id);
    const position = {
      x: Number.isFinite(n.x) ? (n.x as number) : 0,
      y: Number.isFinite(n.y) ? (n.y as number) : 0,
    };
    return createNode(id, n.kind, position, {}, n.label);
  });
  const edges: DesignEdge[] = [];
  for (const e of graph.edges) {
    const s = ids.get(e.source);
    const t = ids.get(e.target);
    if (s && t && s !== t && !edges.some((x) => x.source === s && x.target === t))
      edges.push(createEdge(s, t));
  }
  if (!nodes.some((n) => n.kind === 'client')) {
    const targets = new Set(edges.map((e) => e.target));
    const roots = nodes.filter((n) => !targets.has(n.id));
    nodes.unshift(createNode('client', 'client', { x: -260, y: 0 }, {}, 'Clients'));
    for (const r of roots.length > 0 ? roots : nodes.slice(1, 2))
      edges.push(createEdge('client', r.id));
  }
  return createDesign(name, nodes, edges);
}
