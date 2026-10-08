import type { LatencySummary } from './percentiles';
import { summarizeSorted } from './percentiles';

/** Keeps the latency samples of the last `size` ticks for rolling percentiles. */
export class SampleWindow {
  private readonly buckets: Float64Array[] = [];
  private scratch = new Float64Array(0);

  constructor(private readonly size: number) {}

  push(samples: ArrayLike<number>): void {
    this.buckets.push(Float64Array.from(samples));
    while (this.buckets.length > Math.max(1, this.size)) this.buckets.shift();
  }

  summary(): LatencySummary {
    let count = 0;
    for (const b of this.buckets) count += b.length;
    // Reuse one buffer between ticks to avoid garbage on the hot path.
    if (this.scratch.length < count) this.scratch = new Float64Array(count * 2);
    let offset = 0;
    for (const b of this.buckets) {
      this.scratch.set(b, offset);
      offset += b.length;
    }
    return summarizeSorted(this.scratch.subarray(0, count).sort());
  }

  clear(): void {
    this.buckets.length = 0;
  }
}

/** Exponentially weighted moving average, handy for smoothing noisy series. */
export function ewma(previous: number, next: number, alpha: number): number {
  return previous + alpha * (next - previous);
}
