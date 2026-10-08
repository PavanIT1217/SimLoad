import { hasErrors, validateDesign } from '@simload/engine';
import type { Design } from '@simload/engine';
import { useEffect, useMemo, useRef } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { simulation } from './client';

/** Everything that affects simulation results (node positions and labels do not). */
function simulationSignature(design: Design): string {
  return JSON.stringify({
    nodes: design.nodes.map((n) => [n.id, n.kind, n.config]),
    edges: design.edges.map((e) => [e.id, e.source, e.target, e.weight]),
  });
}

/**
 * Keeps the worker in sync with the design store: structural changes are
 * pushed with updateDesign (state is preserved), traffic changes with
 * setTraffic, and a new seed restarts the run.
 */
export function useSimulationSync(): void {
  const design = useDesignStore((s) => s.design);
  const revision = useDesignStore((s) => s.revision);
  const seed = useSimStore((s) => s.seed);
  const signature = useMemo(() => simulationSignature(design), [design]);
  const valid = useMemo(() => !hasErrors(validateDesign(design)), [design]);
  const loaded = useRef<{ seed: number; revision: number } | null>(null);

  useEffect(() => {
    if (!valid) {
      simulation.pause();
      return;
    }
    const current = useDesignStore.getState().design;
    const prev = loaded.current;
    if (!prev || prev.seed !== seed || prev.revision !== revision) {
      // New seed or a whole new design (scenario, import, share link): start over.
      simulation.load(current, seed);
      loaded.current = { seed, revision };
    } else {
      simulation.updateDesign(current);
    }
  }, [signature, seed, revision, valid]);

  useEffect(() => {
    simulation.setTraffic(design.traffic);
  }, [design.traffic]);
}
