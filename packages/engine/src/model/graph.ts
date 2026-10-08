import type { Design, DesignNode } from './types';

/** An outgoing edge with its normalised routing share. */
export interface Route {
  edgeId: string;
  target: string;
  share: number;
}

/** Precomputed, immutable view of a design used by the simulation. */
export interface CompiledGraph {
  order: string[];
  nodes: Map<string, DesignNode>;
  routes: Map<string, Route[]>;
  clients: string[];
}

/** Kahn topological sort. Returns null when the graph has a cycle. */
export function topologicalOrder(design: Design): string[] | null {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of design.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of design.edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const ready = design.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }
  return order.length === design.nodes.length ? order : null;
}

/** Nodes reachable from any client node. */
export function reachableFromClients(design: Design): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of design.edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const seen = new Set<string>();
  const stack = design.nodes.filter((n) => n.kind === 'client').map((n) => n.id);
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of adjacency.get(id) ?? []) stack.push(next);
  }
  return seen;
}

/** Compiles a (validated, acyclic) design. Throws if it contains a cycle. */
export function compileGraph(design: Design): CompiledGraph {
  const order = topologicalOrder(design);
  if (!order) throw new Error('Design contains a cycle');
  const nodes = new Map(design.nodes.map((n) => [n.id, n]));
  const routes = new Map<string, Route[]>();
  for (const node of design.nodes) {
    const out = design.edges.filter(
      (e) => e.source === node.id && nodes.has(e.target) && e.weight > 0,
    );
    const total = out.reduce((sum, e) => sum + e.weight, 0);
    routes.set(
      node.id,
      out.map((e) => ({ edgeId: e.id, target: e.target, share: total > 0 ? e.weight / total : 0 })),
    );
  }
  const clients = design.nodes.filter((n) => n.kind === 'client').map((n) => n.id);
  return { order, nodes, routes, clients };
}
