import { mmcWaitMs } from './queueing';

/** Requests waiting for service, split by class. */
export interface PoolState {
  backlogRead: number;
  backlogWrite: number;
}

export interface PoolInput {
  /** Arrival rates in req/s. */
  readRps: number;
  writeRps: number;
  /** Total service rate in req/s. */
  capacityRps: number;
  /** Parallel servers (concurrency slots) for the queueing approximation. */
  servers: number;
  maxQueue: number;
  dtS: number;
}

export interface PoolResult {
  processedRead: number;
  processedWrite: number;
  droppedRead: number;
  droppedWrite: number;
  /** Requests still waiting after this tick. */
  backlog: number;
  /** Mean wait before service: queued backlog drain time plus M/M/c delay. */
  waitMs: number;
  /** processed / capacity, 0..1. */
  utilization: number;
  /** offered / capacity (can exceed 1 when overloaded). */
  saturation: number;
}

/** Highest load factor used for the steady-state M/M/c term; overload is handled by the backlog. */
const MAX_STEADY_RHO = 0.98;
/** Wait reported for a pool that cannot serve anything. */
export const STALLED_WAIT_MS = 1e7;
/** Saturation reported for a pool with no capacity that still receives traffic. */
export const STALLED_SATURATION = 1e3;

export function createPoolState(): PoolState {
  return { backlogRead: 0, backlogWrite: 0 };
}

/**
 * Advances a fluid queue by one tick. Arrivals join the backlog, up to
 * `capacityRps * dt` requests are served (shared between classes in
 * proportion to their waiting volume), and backlog beyond `maxQueue` is dropped.
 * Mutates `state` and returns per-second rates.
 */
export function stepPool(state: PoolState, input: PoolInput): PoolResult {
  const { dtS, capacityRps } = input;
  const availRead = state.backlogRead + input.readRps * dtS;
  const availWrite = state.backlogWrite + input.writeRps * dtS;
  const available = availRead + availWrite;
  const capacity = Math.max(0, capacityRps) * dtS;
  const processed = Math.min(available, capacity);
  const readShare = available > 0 ? availRead / available : 0;
  const processedRead = processed * readShare;
  const processedWrite = processed - processedRead;

  let remRead = availRead - processedRead;
  let remWrite = availWrite - processedWrite;
  const remaining = remRead + remWrite;
  const dropped = Math.max(0, remaining - Math.max(0, input.maxQueue));
  const remReadShare = remaining > 0 ? remRead / remaining : 0;
  const droppedRead = dropped * remReadShare;
  const droppedWrite = dropped - droppedRead;
  remRead -= droppedRead;
  remWrite -= droppedWrite;
  state.backlogRead = Math.max(0, remRead);
  state.backlogWrite = Math.max(0, remWrite);

  const offered = input.readRps + input.writeRps;
  const backlog = state.backlogRead + state.backlogWrite;
  let waitMs: number;
  if (capacityRps <= 0) {
    waitMs = offered > 0 || backlog > 0 ? STALLED_WAIT_MS : 0;
  } else {
    const steadyLambda = Math.min(offered, capacityRps * MAX_STEADY_RHO);
    waitMs = (backlog / capacityRps) * 1000 + mmcWaitMs(steadyLambda, capacityRps, input.servers);
  }

  return {
    processedRead: processedRead / dtS,
    processedWrite: processedWrite / dtS,
    droppedRead: droppedRead / dtS,
    droppedWrite: droppedWrite / dtS,
    backlog,
    waitMs,
    utilization: capacity > 0 ? processed / capacity : offered > 0 ? 1 : 0,
    saturation: capacityRps > 0 ? offered / capacityRps : offered > 0 ? STALLED_SATURATION : 0,
  };
}
