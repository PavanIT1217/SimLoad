import type { TickResult } from '@simload/engine';
import { readStorage, writeStorage } from '../../features/persistence/storage';

const INTRO_KEY = 'simload:intro-seen';

/** The welcome card is shown once; after that it only opens from the top bar. */
export function introSeen(): boolean {
  return readStorage(INTRO_KEY) === '1';
}

export function setIntroSeen(): void {
  writeStorage(INTRO_KEY, '1');
}

/** Saturation (offered / capacity) at which a component counts as cracked. */
export const CRACK_SATURATION = 1;
/** Below this peak saturation the design is considered to have held. */
export const HOLD_SATURATION = 0.85;
/** Simulated time after which the prediction is judged even if nothing broke. */
export const JUDGE_AFTER_MS = 20_000;

export interface Verdict {
  /** Most saturated component, or null when everything held. */
  nodeId: string | null;
  saturation: number;
}

/**
 * Decides which component broke first: the most saturated one as soon as
 * any component is overloaded or dead, or after `JUDGE_AFTER_MS` of
 * simulated time. Returns null while it is too early to call.
 */
export function judgeBottleneck(tick: TickResult): Verdict | null {
  let worst: Verdict = { nodeId: null, saturation: 0 };
  let cracked = false;
  for (const node of Object.values(tick.nodes)) {
    if (node.kind === 'client') continue;
    const saturation = node.failed ? Infinity : node.saturation;
    if (saturation >= CRACK_SATURATION) cracked = true;
    if (saturation > worst.saturation) worst = { nodeId: node.id, saturation };
  }
  if (!cracked && tick.timeMs < JUDGE_AFTER_MS) return null;
  return worst.saturation >= HOLD_SATURATION
    ? worst
    : { nodeId: null, saturation: worst.saturation };
}
