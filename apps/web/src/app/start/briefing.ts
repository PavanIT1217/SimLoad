import type { Design, TickResult } from '@simload/engine';
import { readStorage, writeStorage } from '../../features/persistence/storage';
import { formatRps } from '../../ui/format';

const INTRO_KEY = 'simload:intro-seen';

/** Returning visitors who ticked "don't show again" start at the mission step. */
export function introSeen(): boolean {
  return readStorage(INTRO_KEY) === '1';
}

export function setIntroSeen(seen: boolean): void {
  writeStorage(INTRO_KEY, seen ? '1' : '0');
}

/** Pre-flight checklist shown before launch, written from the loaded design. */
export function preflightLines(design: Design): string[] {
  const parts = design.nodes.filter((n) => n.kind !== 'client');
  const entry = parts.find((n) => design.edges.some((e) => e.target === n.id));
  const reads = Math.round(design.traffic.readRatio * 100);
  return [
    `Compiling ${parts.length} components and ${design.edges.length} connections`,
    `Routing ${formatRps(design.traffic.peakRps)} through ${entry?.label ?? 'the entry point'}`,
    `Mixing traffic: ${reads}% reads, ${100 - reads}% writes`,
    'Calibrating latency distributions (seed 42)',
    'Arming telemetry, insights and cost meters',
  ];
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
