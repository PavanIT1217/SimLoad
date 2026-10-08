import { useDeferredValue } from 'react';
import { useSimStore } from '../../state/simStore';
import type { ChartPoint } from '../simulation/protocol';

/**
 * Chart data as a deferred value: React renders chart updates as low-priority,
 * interruptible work, so redrawing charts never blocks dragging or animation.
 */
export function useChartHistory(): ChartPoint[] {
  return useDeferredValue(useSimStore((s) => s.history));
}
