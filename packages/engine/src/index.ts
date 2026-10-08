// Public API of @syssim/engine. Everything consumers may use is exported here.

export type {
  AutoscaleConfig,
  ComponentKind,
  Design,
  DesignEdge,
  DesignNode,
  Fault,
  FaultKind,
  NodeConfig,
  Position,
  SimulationOptions,
  TrafficProfile,
  TrafficSettings,
  ValidationIssue,
} from './model/types';
export { COMPONENT_KINDS } from './model/types';
export {
  DEFAULT_OPTIONS,
  DEFAULT_TRAFFIC,
  KIND_LABELS,
  createDesign,
  createEdge,
  createNode,
  defaultConfig,
} from './model/defaults';
export { hasErrors, validateDesign } from './model/validation';
export { topologicalOrder } from './model/graph';

export {
  MAX_RPS,
  MIN_RPS,
  PROFILE_LABELS,
  TRAFFIC_PROFILES,
  offeredRps,
  profileMultiplier,
  rpsToSlider,
  sliderToRps,
} from './traffic/profiles';

export type { Simulation } from './sim/simulation';
export { CACHE_WARMUP_S, DesignError, createSimulation } from './sim/simulation';
export type { NodeTickState, TickResult } from './sim/result';
export type { RequestTrace, SpanOutcome, TraceSpan } from './sim/sampler';
export type { RequestClass } from './sim/propagation';
export { perInstanceCapacity } from './sim/components';
export { erlangC, littlesLaw, mmcWaitMs } from './sim/queueing';

export type { LatencySummary } from './metrics/percentiles';
export { percentile, summarize } from './metrics/percentiles';
export type { GoalCheck, GoalStatus, GoalTracker, ScenarioGoal } from './metrics/goals';
export { createGoalTracker, describeGoal } from './metrics/goals';
export type { LatencyFit } from './metrics/calibration';
export { fitFromPercentiles, fitLognormal } from './metrics/calibration';

export type { Rng } from './util/rng';
export { createRng } from './util/rng';
