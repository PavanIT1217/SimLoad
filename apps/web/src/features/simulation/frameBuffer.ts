import type { GoalStatus, RequestTrace, TickResult } from '@syssim/engine';
import { useSimStore } from '../../state/simStore';
import type { ChartPoint } from './protocol';

/** Charts and traces redraw at most this often; live readouts follow every animation frame. */
const CHART_INTERVAL_MS = 250;

/**
 * Coalesces worker frames so React renders at most once per animation frame,
 * and charts (the most expensive part of the UI) at most 4 times a second.
 */
export class FrameBuffer {
  private tick: TickResult | null = null;
  private goal: GoalStatus | null = null;
  private points: ChartPoint[] = [];
  private traces: RequestTrace[] = [];
  private scheduled = false;
  private lastChartFlush = 0;

  push(tick: TickResult, points: ChartPoint[], traces: RequestTrace[], goal: GoalStatus | null) {
    this.tick = tick;
    this.goal = goal;
    this.points.push(...points);
    this.traces.push(...traces);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(this.flush);
    }
  }

  clear(): void {
    this.tick = null;
    this.points = [];
    this.traces = [];
  }

  private flush = (now: number): void => {
    this.scheduled = false;
    const store = useSimStore.getState();
    if (this.tick) store.applyLive(this.tick, this.goal);
    this.tick = null;
    if (now - this.lastChartFlush >= CHART_INTERVAL_MS && this.points.length > 0) {
      store.applyCharts(this.points, this.traces);
      this.points = [];
      this.traces = [];
      this.lastChartFlush = now;
    } else if (this.points.length > 0 && !this.scheduled) {
      // Make sure pending chart data lands even if the worker goes quiet (e.g. paused).
      this.scheduled = true;
      requestAnimationFrame(this.flush);
    }
  };
}
