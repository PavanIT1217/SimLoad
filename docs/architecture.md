# Architecture

```
┌──────────────────────── apps/web (main thread) ────────────────────────┐
│  React UI ── Zustand stores (design, sim, ui) ── SimulationClient       │
│     ▲                                                │ WorkerRequest    │
│     │ frames (TickResult, chart points, goal)        ▼                  │
│  ┌──┴───────────── simulation.worker.ts (Web Worker) ───────────────┐   │
│  │   @simload/engine: createSimulation() + createGoalTracker()      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
packages/engine/src
  model/     types, defaults, graph compilation, validateDesign
  traffic/   traffic profiles and the log-scale slider mapping
  sim/       pools (fluid queues), flow (forward pass), propagation (backward
             pass), sampler, routing (per-class, LB health checks), resilience
             (breakers, retry plans), autoscale, state, result, simulation loop,
             planner (capacity search)
  metrics/   percentiles, rolling window, scenario goals, calibration, cost,
             diagnosis (insights + node rules)
  util/      seeded RNG (mulberry32), math (erf, lognormal helpers)
  index.ts   the only public entry point

apps/web/src
  app/       shell: App, TopBar, layout, toast
  features/
    canvas/       React Flow canvas, custom node and edge, toolbar, auto-layout
    palette/      draggable component palette
    inspector/    tabbed right panel, node/edge inspectors, chaos, calibration,
                  load-test parsers (k6, Gatling, JMeter, CSV)
    insights/     bottleneck explainer and cost breakdown
    planner/      capacity planner (own Web Worker)
    estimator/    back-of-the-envelope calculator
    metrics/      Recharts panels, trace viewer, replay bar, run comparison
    simulation/   worker, typed protocol, client, frame buffer, sync hook
    scenarios/    nine scenarios with reference solutions and scripted chaos
    persistence/  autosave, JSON/Mermaid/draw.io import, compressed share links
    report/       Markdown and printable (PDF) reports
  state/          Zustand stores: design (with undo history), sim, ui, layout, runs
  state/     Zustand stores (design, sim, ui)
  ui/        shared primitives (Button, Field, Section, icons, formatting)
```

The engine has no DOM or UI dependencies (lint forbids `window`, `document` and
`localStorage` there). The web app imports it through the package's `source`
export condition, so Vite and TypeScript read the sources directly. `pnpm build`
also emits `dist/` for other consumers.

## Engine: one tick

`createSimulation(design, options)` compiles the design into a topologically
sorted DAG and keeps a `NodeRuntime` per node: backlogs, instances, faults,
cache warmth, pending scale actions, and the previous tick's end-to-end outcome.
Each `step()`:

1. **Housekeeping:** expire timed faults and apply autoscale actions whose boot delay has elapsed.
2. **Offered load:** `peakRps × profile(t)`, split evenly across clients, then into reads and writes.
3. **Forward pass (`sim/flow.ts`):** in topological order, each node's pools
   (`sim/pool.ts`) take the arrivals. Up to `capacity × dt` requests are served
   per tick, and backlog beyond `maxQueue` is dropped. Served traffic (minus cache
   hits and injected errors) is split across outgoing edges by weight. Each edge
   is amplified by the caller's retries, using the callee's failure probability
   from the _previous_ tick. That one-tick feedback lets retry storms build up.
4. **Backward pass (`sim/propagation.ts`):** in reverse order, each node combines
   its drop rate, error rate and timeout probability with its children's
   success and latency, giving the end-to-end success probability and mean
   latency that callers see. The timeout probability is P(service + wait +
   downstream > timeout) for a lognormal service time.
5. **Sample layer (`sim/sampler.ts`):** walks N requests through the graph,
   drawing lognormal service times, adding the current queue wait, and applying
   hit, drop, error, timeout and retry logic. Each walk produces a span trace.
6. **Metrics:** rolling p50/p95/p99 over the last 10 ticks of samples. Goodput
   and error rate come from the flow layer, so rates as small as 0.001% resolve exactly.

### Queueing model

- Pools are fluid queues: backlog grows when inflow exceeds capacity and the
  excess over `maxQueue` is dropped.
- Wait = backlog ÷ capacity + the M/M/c steady-state wait Wq. Wq uses exact
  Erlang C up to 512 servers and the Sakasegawa approximation above that, so it
  stays O(1) at earth scale.
- Effective capacity per instance is min(`capacityRps`, `maxConcurrency` ÷
  service time), which is Little's Law applied to the worker pool.
- Database: the primary pool takes writes (and reads when there are no
  replicas); the replica pool takes reads.
- Queue: callers are acknowledged on enqueue, and the backlog drains to
  downstream at `consumerRps`.

### Routing and resilience

- **Request classes:** every edge carries `all`, `read` or `write` traffic.
  Routes are compiled per class, so reads can go to a cache while writes go to
  a queue. Shares are normalised within each class.
- **Load balancers** health-check their targets: a killed or circuit-open
  target is removed from rotation and its share is spread over the rest.
  Other nodes keep static weights, so a dead dependency fails their calls.
- **Circuit breakers** (closed → open → half-open with 10% probe traffic)
  wrap calls into a node. While a breaker is open, callers fail fast instead
  of queueing.
- **Retry plans** combine the retry count, a budget that caps extra attempts as
  a share of first attempts, and exponential backoff with full jitter (adds
  latency, not load).
- **Rate limits** shed load above a threshold as fast errors before it can
  queue.
- **Sharding:** effective capacity is per-shard capacity divided by the
  hottest shard's share, `1/S + skew·(1 − 1/S)`.
- **Cold starts:** instances added by autoscaling pay `coldStartMs` for 10 s.

### Analysis

- **`diagnose(design, tick)`** applies rules per node: down, breaker open,
  overload, near saturation, timeouts, retry storm, shedding, cold cache, cold
  start. It also adds system rules: single zone, and headroom when healthy.
  Every suggestion is quantified from the live numbers.
- **`planCapacity(design, goal)`** evaluates the design at the target load,
  grows the current bottleneck (instances, read replicas, shards or consumers)
  until the goal passes with ρ ≤ 0.9 everywhere, then trims each change back
  while the goal still holds. It reports when a goal is latency-bound and
  capacity can't fix it.
- **`estimateCost(design, tick)`** adds instance-hours (billable instances,
  counting replicas and shards) to per-million-request usage.

### Determinism

All randomness goes through one seeded `Rng`, consumed in a fixed order. The
flow layer is fully deterministic. Running the same design with the same seed
gives byte-identical `TickResult`s; a test checks this.

## Web app

- **Worker protocol (`features/simulation/protocol.ts`):** a discriminated union
  in each direction. The worker advances `speed × 0.5` ticks every 50 ms of wall
  time and posts one frame with the latest `TickResult`, one aggregated chart
  point, recent traces and the goal status.
- **Sync (`useSimulationSync`):** edits that change simulation semantics are sent
  as `updateDesign`, which keeps queues and other state; position-only changes
  are skipped. Replacing the whole design (scenario, import, link) or changing
  the seed sends `load`, which restarts the run.
- **Stores:** `designStore` holds the design and is the single source of truth
  for the canvas. `simStore` holds live results; components subscribe to narrow
  slices so a frame only re-renders what changed. `uiStore` holds the theme,
  mode, scenario and toasts.
- **Smooth rendering:**
  - The worker caps simulation work at about 70% of each 50 ms frame, so at
    high speeds it slows down instead of falling behind.
  - `FrameBuffer` coalesces worker frames into one store update per animation
    frame, and flushes chart history at most twice a second. Charts draw at
    most 150 points per series.
  - Charts read their data through `useDeferredValue` and are memoised, so a
    redraw is interruptible, low-priority work that never blocks dragging.
  - Node and edge components subscribe to their own slice of the latest tick.
- **Replay:** each chart point carries a compact per-node snapshot. While
  paused, the scrubber selects a point and canvas nodes render from it.
- **Undo history:** the design store keeps up to 100 undo steps. Rapid edits
  with the same key (dragging a node, typing a name, moving the traffic
  slider) merge into one step.
- **Scenario chaos** (zone outages) runs inside the simulation worker at exact
  tick boundaries. Goals with chaos keep their first verdict until Reset.
- **Persistence:** every load path goes through `parseDesign`, which validates
  untrusted JSON and fills missing fields with defaults.

## Deployment

`deploy.yml` builds on pushes to `main` and publishes `apps/web/dist` with
`actions/deploy-pages` to https://simload.webappslab.com/. It sets
`VITE_BASE=/` for the custom domain. Without it, `vite.config.ts` derives
`/<repo>/` from `GITHUB_REPOSITORY`.
