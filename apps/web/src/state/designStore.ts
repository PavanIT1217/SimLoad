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

export type Selection = { type: 'node'; id: string } | { type: 'edge'; id: string } | null;

export interface DesignState {
  design: Design;
  /** Incremented whenever the whole design is replaced (not on edits). */
  revision: number;
  selection: Selection;
  setDesign(design: Design): void;
  rename(name: string): void;
  addNode(kind: ComponentKind, position: Position): string;
  updateNode(id: string, patch: Partial<Pick<DesignNode, 'label'>>): void;
  updateNodeConfig(id: string, patch: Partial<NodeConfig>): void;
  moveNode(id: string, position: Position): void;
  removeNode(id: string): void;
  connect(source: string, target: string): void;
  updateEdge(id: string, patch: Partial<Pick<DesignEdge, 'weight'>>): void;
  removeEdge(id: string): void;
  setTraffic(patch: Partial<TrafficSettings>): void;
  select(selection: Selection): void;
}

const EMPTY_DESIGN: Design = {
  version: 1,
  name: 'Untitled design',
  nodes: [],
  edges: [],
  traffic: { peakRps: 1_000, profile: 'steady', readRatio: 0.9 },
};

function uniqueId(kind: ComponentKind, nodes: readonly DesignNode[]): string {
  const taken = new Set(nodes.map((n) => n.id));
  let i = nodes.filter((n) => n.kind === kind).length + 1;
  while (taken.has(`${kind}-${i}`)) i++;
  return `${kind}-${i}`;
}

function mapNode(design: Design, id: string, fn: (node: DesignNode) => DesignNode): Design {
  return { ...design, nodes: design.nodes.map((n) => (n.id === id ? fn(n) : n)) };
}

export const useDesignStore = create<DesignState>()((set, get) => ({
  design: EMPTY_DESIGN,
  revision: 0,
  selection: null,

  setDesign: (design) => set((s) => ({ design, revision: s.revision + 1, selection: null })),

  rename: (name) => set(({ design }) => ({ design: { ...design, name } })),

  addNode: (kind, position) => {
    const { design } = get();
    const id = uniqueId(kind, design.nodes);
    const node = createNode(id, kind, position);
    const sameKind = design.nodes.filter((n) => n.kind === kind).length;
    if (sameKind > 0) node.label = `${node.label} ${sameKind + 1}`;
    set({ design: { ...design, nodes: [...design.nodes, node] }, selection: { type: 'node', id } });
    return id;
  },

  updateNode: (id, patch) =>
    set(({ design }) => ({ design: mapNode(design, id, (n) => ({ ...n, ...patch })) })),

  updateNodeConfig: (id, patch) =>
    set(({ design }) => ({
      design: mapNode(design, id, (n) => ({ ...n, config: { ...n.config, ...patch } })),
    })),

  moveNode: (id, position) =>
    set(({ design }) => ({ design: mapNode(design, id, (n) => ({ ...n, position })) })),

  removeNode: (id) =>
    set(({ design, selection }) => ({
      design: {
        ...design,
        nodes: design.nodes.filter((n) => n.id !== id),
        edges: design.edges.filter((e) => e.source !== id && e.target !== id),
      },
      selection: selection?.id === id ? null : selection,
    })),

  connect: (source, target) =>
    set(({ design }) => {
      if (source === target) return {};
      if (design.edges.some((e) => e.source === source && e.target === target)) return {};
      return { design: { ...design, edges: [...design.edges, createEdge(source, target)] } };
    }),

  updateEdge: (id, patch) =>
    set(({ design }) => ({
      design: { ...design, edges: design.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
    })),

  removeEdge: (id) =>
    set(({ design, selection }) => ({
      design: { ...design, edges: design.edges.filter((e) => e.id !== id) },
      selection: selection?.id === id ? null : selection,
    })),

  setTraffic: (patch) =>
    set(({ design }) => ({ design: { ...design, traffic: { ...design.traffic, ...patch } } })),

  select: (selection) => set({ selection }),
}));
