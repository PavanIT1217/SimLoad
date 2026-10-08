import type { DesignNode } from '../model/types';
import { clamp } from '../util/math';
import { perInstanceCapacity } from './components';
import type { NodeRuntime } from './state';

/** Scale in only when saturation falls below this fraction of the target. */
const SCALE_IN_FACTOR = 0.5;

/** Instances needed to run `offeredRps` at the node's target utilization. */
export function desiredInstances(node: DesignNode, offeredRps: number): number {
  const policy = node.config.autoscale;
  const perInstance = perInstanceCapacity(node.config);
  if (perInstance <= 0) return policy.maxInstances;
  const target = clamp(policy.targetUtilization, 0.05, 1);
  const needed = Math.ceil(offeredRps / (perInstance * target));
  return clamp(needed, Math.max(1, policy.minInstances), Math.max(1, policy.maxInstances));
}

/** How long a newly started instance pays its cold-start penalty. */
export const WARMUP_MS = 10_000;

/** Applies a pending scaling action once its delay has elapsed. */
export function applyPendingScale(runtime: NodeRuntime, nowMs: number): void {
  if (runtime.pendingScale && nowMs >= runtime.pendingScale.atMs) {
    const added = runtime.pendingScale.target - runtime.instances;
    if (added > 0) runtime.warming.push({ count: added, untilMs: nowMs + WARMUP_MS });
    runtime.instances = runtime.pendingScale.target;
    runtime.pendingScale = null;
  }
}

/**
 * Decides whether to scale based on the offered load this tick. New capacity
 * only arrives after `delayMs`, mimicking instance boot time.
 */
export function evaluateAutoscale(
  node: DesignNode,
  runtime: NodeRuntime,
  offeredRps: number,
  nowMs: number,
): void {
  const policy = node.config.autoscale;
  if (!policy.enabled || node.kind === 'client' || node.kind === 'queue') return;
  const desired = desiredInstances(node, offeredRps);
  const current = runtime.pendingScale?.target ?? runtime.instances;
  const perInstance = perInstanceCapacity(node.config);
  const saturation = offeredRps / Math.max(perInstance * runtime.instances, 1e-9);
  const scaleOut = desired > current;
  const scaleIn = desired < current && saturation < policy.targetUtilization * SCALE_IN_FACTOR;
  if (scaleOut || scaleIn) {
    // Keep the original deadline when an in-flight action is merely resized.
    const pending = runtime.pendingScale;
    const sameDirection = pending !== null && pending.target > runtime.instances === scaleOut;
    const atMs = sameDirection ? pending.atMs : nowMs + Math.max(0, policy.delayMs);
    runtime.pendingScale = { target: desired, atMs };
  }
}
