import type { TickResult } from '../sim/result';

/** A pass/fail target for a prep-mode scenario. */
export interface ScenarioGoal {
  /** Offered load the design must sustain. */
  targetRps: number;
  maxP99Ms: number;
  maxErrorRate: number;
  /** Simulated seconds the goal must hold at the target load. */
  holdSeconds: number;
  /** Optional budget: estimated monthly cost (USD) must stay under this. */
  maxMonthlyCost?: number;
}

export interface GoalCheck {
  label: string;
  actual: number;
  limit: number;
  ok: boolean;
}

export interface GoalStatus {
  state: 'pending' | 'pass' | 'fail';
  /** 0..1 progress towards a verdict. */
  progress: number;
  checks: GoalCheck[];
  message: string;
}

interface Observation {
  timeMs: number;
  p99: number;
  offered: number;
  failed: number;
  cost: number;
}

/** Maps a tick to its estimated monthly cost (needed for budget goals). */
export type CostFn = (tick: TickResult) => number;

/** Ticks at the start of a run at target load that are ignored while queues settle. */
const SETTLE_TICKS = 10;

export function describeGoal(goal: ScenarioGoal): string {
  const budget =
    goal.maxMonthlyCost !== undefined
      ? ` under $${goal.maxMonthlyCost.toLocaleString('en-US')}/month`
      : '';
  return (
    `Keep p99 < ${goal.maxP99Ms} ms and error rate < ${(goal.maxErrorRate * 100).toFixed(2)}% ` +
    `at ${goal.targetRps.toLocaleString('en-US')} req/s for ${goal.holdSeconds}s${budget}`
  );
}

export interface GoalTracker {
  /** Records one tick and returns the updated status. */
  observe(result: TickResult): GoalStatus;
  status(): GoalStatus;
  reset(): void;
}

/**
 * Tracks a running simulation against a goal. The verdict is computed over
 * the most recent `holdSeconds` of ticks where offered load is at the target.
 */
export interface GoalTrackerOptions {
  /** Keep the first pass/fail verdict until reset (for runs with scripted chaos). */
  latch?: boolean;
}

export function createGoalTracker(
  goal: ScenarioGoal,
  costOf?: CostFn,
  options: GoalTrackerOptions = {},
): GoalTracker {
  let atTarget: Observation[] = [];
  let settle = 0;
  let verdict: GoalStatus | null = null;

  const tracker: GoalTracker = {
    observe(result: TickResult): GoalStatus {
      if (verdict) return verdict;
      if (result.offeredRps < goal.targetRps * 0.99) {
        atTarget = [];
        settle = 0;
      } else if (settle < SETTLE_TICKS) {
        settle++;
      } else {
        atTarget.push({
          timeMs: result.timeMs,
          p99: result.latency.p99,
          offered: result.offeredRps,
          failed: result.offeredRps * result.errorRate,
          cost: costOf ? costOf(result) : 0,
        });
        const cutoff = result.timeMs - goal.holdSeconds * 1000;
        while (atTarget.length > 0 && (atTarget[0] as Observation).timeMs <= cutoff) {
          atTarget.shift();
        }
      }
      const status = tracker.status();
      if (options.latch && status.state !== 'pending') verdict = status;
      return status;
    },
    status(): GoalStatus {
      const first = atTarget[0];
      const last = atTarget[atTarget.length - 1];
      const spanMs = first && last ? last.timeMs - first.timeMs : 0;
      const tickMs = atTarget.length > 1 && first && last ? spanMs / (atTarget.length - 1) : 0;
      const progress = Math.min(1, (spanMs + tickMs) / (goal.holdSeconds * 1000));
      const p99 =
        atTarget.length > 0 ? atTarget.reduce((sum, o) => sum + o.p99, 0) / atTarget.length : 0;
      const offered = atTarget.reduce((sum, o) => sum + o.offered, 0);
      const errorRate = offered > 0 ? atTarget.reduce((s, o) => s + o.failed, 0) / offered : 0;
      const checks: GoalCheck[] = [
        { label: 'p99 latency (ms)', actual: p99, limit: goal.maxP99Ms, ok: p99 < goal.maxP99Ms },
        {
          label: 'Error rate',
          actual: errorRate,
          limit: goal.maxErrorRate,
          ok: errorRate < goal.maxErrorRate,
        },
      ];
      if (goal.maxMonthlyCost !== undefined && costOf) {
        const cost = atTarget.length > 0 ? Math.max(...atTarget.map((o) => o.cost)) : 0;
        checks.push({
          label: 'Monthly cost ($)',
          actual: cost,
          limit: goal.maxMonthlyCost,
          ok: cost <= goal.maxMonthlyCost,
        });
      }
      if (atTarget.length === 0 || progress < 1) {
        return {
          state: 'pending',
          progress: atTarget.length === 0 ? 0 : progress,
          checks,
          message:
            atTarget.length === 0
              ? `Run at >= ${goal.targetRps.toLocaleString('en-US')} req/s to evaluate`
              : 'Measuring at target load...',
        };
      }
      const pass = checks.every((c) => c.ok);
      return {
        state: pass ? 'pass' : 'fail',
        progress: 1,
        checks,
        message: pass
          ? 'Goal met'
          : `Failed: ${checks
              .filter((c) => !c.ok)
              .map((c) => c.label)
              .join(', ')}`,
      };
    },
    reset(): void {
      atTarget = [];
      settle = 0;
      verdict = null;
    },
  };
  return tracker;
}
