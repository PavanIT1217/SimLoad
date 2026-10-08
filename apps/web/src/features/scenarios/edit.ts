import { createEdge } from '@syssim/engine';
import type { Design, DesignNode, EdgeTraffic, NodeConfig } from '@syssim/engine';

/** Small helpers for deriving reference solutions from starting designs. */
export function tune(design: Design, id: string, patch: Partial<NodeConfig>): Design {
  const node = design.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown node ${id}`);
  node.config = { ...node.config, ...patch };
  return design;
}

export function addNode(design: Design, node: DesignNode): Design {
  design.nodes.push(node);
  return design;
}

export function removeEdge(design: Design, source: string, target: string): Design {
  design.edges = design.edges.filter((e) => !(e.source === source && e.target === target));
  return design;
}

export function connect(
  design: Design,
  source: string,
  target: string,
  traffic: EdgeTraffic = 'all',
): Design {
  design.edges.push(createEdge(source, target, 1, traffic));
  return design;
}

/** Inserts `node` on the edge source → target. */
export function insertBetween(
  design: Design,
  source: string,
  target: string,
  node: DesignNode,
): Design {
  removeEdge(design, source, target);
  addNode(design, node);
  connect(design, source, node.id);
  connect(design, node.id, target);
  return design;
}

export function moveTo(design: Design, id: string, x: number, y: number): Design {
  const node = design.nodes.find((n) => n.id === id);
  if (node) node.position = { x, y };
  return design;
}

export function solved(design: Design): Design {
  design.name = `${design.name} (reference solution)`;
  return design;
}
