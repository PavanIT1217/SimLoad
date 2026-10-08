import { useDeferredValue, useMemo } from 'react';
import { useSimStore } from '../../state/simStore';
import type { ChartPoint } from '../simulation/protocol';

/** Points drawn per series; longer histories are thinned (keeping the latest point). */
export const MAX_CHART_POINTS = 150;

export function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const step = points.length / max;
  const out: T[] = [];
  for (let i = points.length - 1; i >= 0 && out.length < max; i -= step)
    out.push(points[Math.floor(i)] as T);
  return out.reverse();
}

/**
 * Chart data as a deferred value: React renders chart updates as low-priority,
 * interruptible work, so redrawing charts never blocks dragging or animation.
 */
export function useChartHistory(): ChartPoint[] {
  const history = useDeferredValue(useSimStore((s) => s.history));
  return useMemo(() => downsample(history, MAX_CHART_POINTS), [history]);
}
