# Architecture

```
┌──────────────────────── apps/web (main thread) ────────────────────────┐
│  React UI ── Zustand stores (design, sim, ui) ── SimulationClient       │
│     ▲                                                │ WorkerRequest    │
│     │ frames (TickResult, chart points, goal)        ▼                  │
│  ┌──┴───────────── simulation.worker.ts (Web Worker) ───────────────┐   │
│  │   @syssim/engine: createSimulation() + createGoalTracker()      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
packages/engine/src
  model/     types, defaults, graph compilation, validateDesign
  traffic/   traffic profiles and the log-scale slider mapping
  sim/       pools (fluid queues), flow (forward pass), propagation (backward
             pass), sampler, autoscale, faults/state, result, simulation loop
  metrics/   percentiles, rolling window, scenario goals, latency calibration
  util/      seeded RNG (mulberry32), math (erf, lognormal helpers)
  index.ts   the only public entry point

apps/web/src
  app/       shell: App, TopBar, layout, toast
  features/
    canvas/       React Flow canvas, custom node and edge
    palette/      draggable component palette
    inspector/    node/edge inspectors, chaos actions, calibration, CSV parsing
    metrics/      Recharts panels and the trace viewer
    simulation/   worker, typed protocol, client, sync hook, controls
    scenarios/    built-in prep scenarios, goal banner
    persistence/  autosave, import/export, share links, JSON schema parsing
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
- **Persistence:** every load path goes through `parseDesign`, which validates
  untrusted JSON and fills missing fields with defaults.

## Deployment

`deploy.yml` builds on pushes to `main` and publishes `apps/web/dist` with
`actions/deploy-pages`. `vite.config.ts` sets `base` to `/<repo>/` from
`GITHUB_REPOSITORY`; set `VITE_BASE` to override it.
