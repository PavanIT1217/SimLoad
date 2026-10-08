import { useSimStore } from '../../state/simStore';

/** Simulated time (s) being replayed, or null when live. */
export function useReplayTime(): number | null {
  return useSimStore((s) =>
    s.replayIndex !== null ? (s.history[s.replayIndex]?.t ?? null) : null,
  );
}
