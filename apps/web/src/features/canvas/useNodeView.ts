import type { FaultKind } from '@simload/engine';
import { useSimStore } from '../../state/simStore';

/** What a canvas node displays, from the live tick or a replayed snapshot. */
export interface NodeView {
  inflowRps: number;
  saturation: number;
  queueDepth: number;
  latencyMs: number;
  instances: number | undefined;
  failed: boolean;
  successRate: number;
  faults: FaultKind[];
  replay: boolean;
}

const NO_FAULTS: FaultKind[] = [];

/** Node state for rendering; while replaying it comes from the recorded snapshot. */
export function useNodeView(id: string): NodeView | null {
  const snap = useSimStore((s) =>
    s.replayIndex !== null ? s.history[s.replayIndex]?.nodes[id] : undefined,
  );
  const live = useSimStore((s) => s.latest?.nodes[id]);
  if (snap) {
    return {
      inflowRps: snap.i,
      saturation: snap.s,
      queueDepth: snap.q,
      latencyMs: snap.w,
      instances: snap.n,
      failed: snap.f === 1,
      successRate: snap.ok,
      faults: NO_FAULTS,
      replay: true,
    };
  }
  if (!live) return null;
  return { ...live, replay: false };
}
