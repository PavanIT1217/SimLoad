import type { Simulation } from '@syssim/engine';
import type { ScenarioChaos } from './types';

/**
 * Fires scripted chaos when simulated time reaches each event. Call before
 * every step; `fired` remembers what already ran in this run.
 */
export function applyDueChaos(
  sim: Simulation,
  events: readonly ScenarioChaos[],
  fired: Set<number>,
): void {
  events.forEach((event, i) => {
    if (fired.has(i) || sim.timeMs < event.atS * 1000) return;
    fired.add(i);
    for (const node of sim.design.nodes) {
      if (node.zone === event.zone)
        sim.injectFault(node.id, { kind: 'kill' }, event.durationS * 1000);
    }
  });
}
