import type { Design } from '@simload/engine';

/** Undo steps kept in memory. */
export const HISTORY_LIMIT = 100;
/** Edits with the same key within this window merge into one undo step (drags, typing). */
export const COALESCE_MS = 800;

export interface HistoryState {
  past: Design[];
  future: Design[];
}

export interface Coalescer {
  /** True when this edit should merge into the previous undo step. */
  merge(key: string | null, now: number): boolean;
  reset(): void;
}

export function createCoalescer(): Coalescer {
  let lastKey: string | null = null;
  let lastAt = 0;
  return {
    merge(key, now) {
      const merged = key !== null && key === lastKey && now - lastAt < COALESCE_MS;
      lastKey = key;
      lastAt = now;
      return merged;
    },
    reset() {
      lastKey = null;
    },
  };
}

/** Pushes `previous` onto the undo stack (unless merged) and clears redo. */
export function pushHistory(h: HistoryState, previous: Design, merge: boolean): HistoryState {
  if (merge) return { past: h.past, future: [] };
  return { past: [...h.past, previous].slice(-HISTORY_LIMIT), future: [] };
}
