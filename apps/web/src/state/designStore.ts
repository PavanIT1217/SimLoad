import { createEdge, createNode } from '@syssim/engine';
import type {
  ComponentKind,
  Design,
  DesignEdge,
  DesignNode,
  NodeConfig,
  Position,
  TrafficSettings,
} from '@syssim/engine';
import { create } from 'zustand';
import type { HistoryState } from './history';
import { createCoalescer, pushHistory } from './history';

export type Selection = { type: 'node'; id: string } | { type: 'edge'; id: string } | null;

export interface DesignState extends HistoryState {
  design: Design;
  /** Incremented whenever the whole design is replaced (not on edits). */
  revision: number;
  selection: Selection;
  /** Node copied with Ctrl+C, pasted with Ctrl+V. */
  clipboard: DesignNode | null;
  setDesign(design: Design): void;
  rename(name: string): void;
  addNode(kind: ComponentKind, position: Position): string;
  updateNode(id: string, patch: Partial<Pick<DesignNode, 'label' | 'zone'>>): void;
  updateNodeConfig(id: string, patch: Partial<NodeConfig>): void;
  moveNode(id: string, position: Position): void;
  /** Moves many nodes as one undo step (auto-layout). */
  moveNodes(positions: Record<string, Position>): void;
  removeNode(id: string): void;
  connect(source: string, target: string): void;
  updateEdge(id: string, patch: Partial<Pick<DesignEdge, 'weight' | 'traffic'>>): void;
  removeEdge(id: string): void;
  setTraffic(patch: Partial<TrafficSettings>): void;
  select(selection: Selection): void;
  undo(): void;
  redo(): void;
  copySelection(): boolean;
  paste(): string | null;
}

const EMPTY_DESIGN: Design = {
  version: 1,
  name: 'Untitled design',
  nodes: [],
  edges: [],
  traffic: { peakRps: 1_000, profile: 'steady', readRatio: 0.9 },
};

const PASTE_OFFSET = 40;

function uniqueId(kind: ComponentKind, nodes: readonly DesignNode[]): string {
  const taken = new Set(nodes.map((n) => n.id));
  let i = nodes.filter((n) => n.kind === kind).length + 1;
  while (taken.has(`${kind}-${i}`)) i++;
  return `${kind}-${i}`;
}

function mapNode(design: Design, id: string, fn: (node: DesignNode) => DesignNode): Design {
  return { ...design, nodes: design.nodes.map((n) => (n.id === id ? fn(n) : n)) };
}

/** Drops a selection that points at something no longer in the design. */
function validSelection(design: Design, selection: Selection): Selection {
  if (!selection) return null;
  const list = selection.type === 'node' ? design.nodes : design.edges;
  return list.some((x) => x.id === selection.id) ? selection : null;
}

export const useDesignStore = create<DesignState>()((set, get) => {
  const coalescer = createCoalescer();

  /** Applies an edit and records an undo step; `key` merges rapid repeats (drags, typing). */
  const edit = (
    fn: (design: Design) => Design,
    key: string | null = null,
    extra: Partial<DesignState> = {},
  ) =>
    set((s) => {
      const next = fn(s.design);
      if (next === s.design) return {};
      const merge = coalescer.merge(key, performance.now());
      return { design: next, ...pushHistory(s, s.design, merge), ...extra };
    });

  return {
    design: EMPTY_DESIGN,
    revision: 0,
    selection: null,
    clipboard: null,
    past: [],
    future: [],

    setDesign: (design) => {
      coalescer.reset();
      set((s) => ({ design, revision: s.revision + 1, selection: null, past: [], future: [] }));
    },

    rename: (name) => edit((d) => ({ ...d, name }), 'rename'),

    addNode: (kind, position) => {
      const { design } = get();
      const id = uniqueId(kind, design.nodes);
      const node = createNode(id, kind, position);
      const sameKind = design.nodes.filter((n) => n.kind === kind).length;
      if (sameKind > 0) node.label = `${node.label} ${sameKind + 1}`;
      edit((d) => ({ ...d, nodes: [...d.nodes, node] }), null, { selection: { type: 'node', id } });
      return id;
    },

    updateNode: (id, patch) =>
      edit(
        (d) => mapNode(d, id, (n) => ({ ...n, ...patch })),
        `node:${id}:${Object.keys(patch).join()}`,
      ),

    updateNodeConfig: (id, patch) =>
      edit((d) => mapNode(d, id, (n) => ({ ...n, config: { ...n.config, ...patch } }))),

    moveNode: (id, position) =>
      edit((d) => mapNode(d, id, (n) => ({ ...n, position })), `move:${id}`),

    moveNodes: (positions) =>
      edit((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          positions[n.id] ? { ...n, position: positions[n.id] as Position } : n,
        ),
      })),

    removeNode: (id) =>
      edit(
        (d) => ({
          ...d,
          nodes: d.nodes.filter((n) => n.id !== id),
          edges: d.edges.filter((e) => e.source !== id && e.target !== id),
        }),
        null,
        { selection: get().selection?.id === id ? null : get().selection },
      ),

    connect: (source, target) =>
      edit((d) => {
        if (source === target) return d;
        if (d.edges.some((e) => e.source === source && e.target === target)) return d;
        return { ...d, edges: [...d.edges, createEdge(source, target)] };
      }),

    updateEdge: (id, patch) =>
      edit((d) => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

    removeEdge: (id) =>
      edit((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }), null, {
        selection: get().selection?.id === id ? null : get().selection,
      }),

    setTraffic: (patch) => edit((d) => ({ ...d, traffic: { ...d.traffic, ...patch } }), 'traffic'),

    select: (selection) => set({ selection }),

    undo: () =>
      set((s) => {
        const previous = s.past[s.past.length - 1];
        if (!previous) return {};
        coalescer.reset();
        return {
          design: previous,
          past: s.past.slice(0, -1),
          future: [s.design, ...s.future],
          selection: validSelection(previous, s.selection),
        };
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0];
        if (!next) return {};
        coalescer.reset();
        return {
          design: next,
          past: [...s.past, s.design],
          future: s.future.slice(1),
          selection: validSelection(next, s.selection),
        };
      }),

    copySelection: () => {
      const { selection, design } = get();
      const node =
        selection?.type === 'node' ? design.nodes.find((n) => n.id === selection.id) : null;
      if (!node || node.kind === 'client') return false;
      set({ clipboard: structuredClone(node) });
      return true;
    },

    paste: () => {
      const { clipboard, design } = get();
      if (!clipboard) return null;
      const id = uniqueId(clipboard.kind, design.nodes);
      const copy: DesignNode = {
        ...structuredClone(clipboard),
        id,
        label: `${clipboard.label} copy`,
        position: {
          x: clipboard.position.x + PASTE_OFFSET,
          y: clipboard.position.y + PASTE_OFFSET,
        },
      };
      edit((d) => ({ ...d, nodes: [...d.nodes, copy] }), null, {
        selection: { type: 'node', id },
        // Successive pastes cascade instead of stacking on top of each other.
        clipboard: { ...clipboard, position: copy.position },
      });
      return id;
    },
  };
});
