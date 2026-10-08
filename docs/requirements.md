# Requirements: System Design Simulator v1

## Purpose

A browser app that simulates how a system architecture behaves under traffic from
1 req/s up to 100M req/s ("earth scale"). It serves two audiences:

- **Interview prep:** practise designing systems against concrete, measurable goals.
- **Architecture validation:** calibrate components from real measurements and see
  where a design saturates, queues, drops and fails.

## Constraints

- Runs 100% client-side and deploys as a static site to GitHub Pages.
- No backend, no accounts, no network calls at runtime.
- Deterministic: the same seed and design always give the same results.

## Functional requirements

### Components

Client (traffic source), CDN, Load Balancer, Service, Cache, Queue, Database
(primary + read replicas; writes only go to the primary), External API.

| Property                                                  | Applies to                  |
| --------------------------------------------------------- | --------------------------- |
| `capacityRps`, `instances`                                | all except Client and Queue |
| `baseLatencyMs`, `latencySigma` (variance)                | all except Client           |
| `maxConcurrency` (pool size), `maxQueue`                  | all except Client           |
| `timeoutMs`, `retries`                                    | all                         |
| `hitRatio` (reads only)                                   | Cache, CDN                  |
| `replicas`                                                | Database                    |
| `consumerRps`                                             | Queue                       |
| autoscale on/off, boot delay, min/max, target utilisation | all except Client and Queue |

Edges carry a routing weight.

### Traffic

- Log-scale peak load from 1 to 100,000,000 req/s.
- Profiles: steady, daily wave, flash spike, ramp (each peaks at the slider value).
- Read/write ratio.

### Simulation

- Hybrid model: a rate-based flow layer (100 ms ticks by default) plus a
  sample layer that walks individual requests (200 per tick by default).
- Per node: inflow, effective capacity, backlog, served, dropped, utilisation,
  latency (base + queueing + injected), timeouts, retries, which cause retry storms.
- End-to-end p50/p95/p99 from samples; request traces.
- Chaos: kill node, add latency, flush cache, trigger retry storm.

### UI

- Top bar: mode, scenario picker, traffic slider, profile, read ratio,
  run/pause/step/reset, speed (1x to 100x), seed, file actions, theme.
- Left: component palette (drag onto canvas or click to add).
- Centre: React Flow canvas. Nodes are coloured by utilisation and show
  req/s, queue depth and latency. Edges are animated, and their thickness is
  proportional to log(flow).
- Right: inspector for the selected node or edge, or a design overview with
  validation issues.
- Bottom: live charts (latency percentiles, throughput vs offered, error rate,
  per-node utilisation) and a sampled-request trace viewer.
- Dark/light theme and responsive layout.

### Modes

- **Prep:** at least three scenarios (URL shortener, news feed, ticket flash sale),
  each with a goal ("keep p99 < X ms and errors < Y% at Z req/s for N s") and
  pass/fail feedback. Each starting design misses its goal on purpose.
- **Validation:** enter measured p50/p99 latency and per-instance capacity for a
  node, or import a CSV of latency samples to fit its lognormal distribution.

### Persistence

- Autosave to localStorage (failures are tolerated).
- Export and import design JSON.
- Shareable link with the design encoded in the URL hash.

## Out of scope (v1)

Live calls to real APIs, cloud cost estimation, multiplayer, accounts.

## Quality

- Engine unit tests: queueing math, overload and backlog, drops, timeouts, retry
  amplification, cache-hit routing, read/write split, seed determinism, validation.
- `pnpm check` (format, lint, typecheck, test) passes; `pnpm build` has zero warnings.
- Strict TypeScript, no `any`, small modules (around 250 lines or fewer).
