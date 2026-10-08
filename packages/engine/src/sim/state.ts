import type { DesignNode, Fault, FaultKind } from '../model/types';
import type { PoolName } from './components';
import type { PoolState } from './pool';
import { createPoolState } from './pool';

export interface ActiveFault {
  fault: Fault;
  /** Simulated time at which the fault clears itself, or null for "until cleared". */
  untilMs: number | null;
}

export interface PendingScale {
  target: number;
  atMs: number;
}

/** Mutable per-node state that survives across ticks. */
export interface NodeRuntime {
  instances: number;
  pools: Record<PoolName, PoolState>;
  faults: Map<FaultKind, ActiveFault>;
  /** 0..1 multiplier on cache hit ratio; drops to 0 on flush and warms back up. */
  cacheWarmth: number;
  pendingScale: PendingScale | null;
  /** End-to-end success probability seen by callers, from the previous tick. */
  successRead: number;
  successWrite: number;
  /** End-to-end mean latency seen by callers, from the previous tick. */
  latencyReadMs: number;
  latencyWriteMs: number;
}

export function createNodeRuntime(node: DesignNode): NodeRuntime {
  return {
    instances: Math.max(1, Math.floor(node.config.instances)),
    pools: { main: createPoolState(), primary: createPoolState(), replica: createPoolState() },
    faults: new Map(),
    cacheWarmth: 1,
    pendingScale: null,
    successRead: 1,
    successWrite: 1,
    latencyReadMs: 0,
    latencyWriteMs: 0,
  };
}

/** Removes faults whose duration has elapsed. */
export function expireFaults(runtime: NodeRuntime, nowMs: number): void {
  for (const [kind, active] of runtime.faults) {
    if (active.untilMs !== null && nowMs >= active.untilMs) runtime.faults.delete(kind);
  }
}

export function clearBacklog(runtime: NodeRuntime): void {
  for (const pool of Object.values(runtime.pools)) {
    pool.backlogRead = 0;
    pool.backlogWrite = 0;
  }
}

export function injectedLatencyMs(runtime: NodeRuntime): number {
  const f = runtime.faults.get('latency')?.fault;
  return f && f.kind === 'latency' ? Math.max(0, f.addMs) : 0;
}

export function injectedErrorRate(runtime: NodeRuntime): number {
  const f = runtime.faults.get('errorRate')?.fault;
  return f && f.kind === 'errorRate' ? Math.min(1, Math.max(0, f.rate)) : 0;
}

export function isKilled(runtime: NodeRuntime): boolean {
  return runtime.faults.has('kill');
}
