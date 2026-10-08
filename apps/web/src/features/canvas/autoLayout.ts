import { topologicalOrder } from '@simload/engine';
import type { Design, Position } from '@simload/engine';

export const LAYER_GAP = 260;
export const ROW_GAP = 130;

/**
 * Layered (Sugiyama-style) layout for the request DAG: each node's column is
 * its longest path from a source, rows are ordered by the average row of its
 * parents (barycentre) to reduce crossings, and columns are centred vertically.
 */
export function autoLayout(design: Design): Record<string, Position> {
  const order = topologicalOrder(design) ?? design.nodes.map((n) => n.id);
  const parents = new Map<string, string[]>();
  for (const e of design.edges) parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);

  const layer = new Map<string, number>();
  for (const id of order) {
    const ps = parents.get(id) ?? [];
    layer.set(id, ps.length === 0 ? 0 : Math.max(...ps.map((p) => (layer.get(p) ?? 0) + 1)));
  }

  const layers: string[][] = [];
  for (const id of order) {
    const l = layer.get(id) ?? 0;
    (layers[l] ??= []).push(id);
  }

  const row = new Map<string, number>();
  for (const ids of layers) {
    if (!ids) continue;
    const scored = ids.map((id, i) => {
      const ps = (parents.get(id) ?? []).filter((p) => row.has(p));
      const bary = ps.length > 0 ? ps.reduce((s, p) => s + (row.get(p) ?? 0), 0) / ps.length : i;
      return { id, bary };
    });
    scored.sort((a, b) => a.bary - b.bary);
    scored.forEach((s, i) => row.set(s.id, i));
  }

  const tallest = Math.max(1, ...layers.map((ids) => ids?.length ?? 0));
  const positions: Record<string, Position> = {};
  layers.forEach((ids, l) => {
    if (!ids) return;
    const offset = ((tallest - ids.length) * ROW_GAP) / 2;
    for (const id of ids) {
      positions[id] = { x: l * LAYER_GAP, y: offset + (row.get(id) ?? 0) * ROW_GAP };
    }
  });
  return positions;
}
