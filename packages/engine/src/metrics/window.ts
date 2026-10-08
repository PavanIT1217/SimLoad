import type { LatencySummary } from './percentiles';
import { summarize } from './percentiles';

/** Keeps the latency samples of the last `size` ticks for rolling percentiles. */
export class SampleWindow {
  private readonly buckets: number[][] = [];

  constructor(private readonly size: number) {}

  push(samples: readonly number[]): void {
    this.buckets.push([...samples]);
    while (this.buckets.length > Math.max(1, this.size)) this.buckets.shift();
  }

  summary(): LatencySummary {
    return summarize(this.buckets.flat());
  }

  clear(): void {
    this.buckets.length = 0;
  }
}

/** Exponentially weighted moving average, handy for smoothing noisy series. */
export function ewma(previous: number, next: number, alpha: number): number {
  return previous + alpha * (next - previous);
}
