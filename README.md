# System Design Simulator

Simulate how a system architecture behaves under traffic from **1 req/s up to
100M req/s** ("earth scale"), entirely in your browser. Draw a design, turn up
the load, and watch queues build, latency climb, caches save you and retry
storms take you down.

Use it for **system-design interview prep** (built-in scenarios with pass/fail
goals) and for **validating real architectures** (calibrate nodes from measured
latency and capacity).

**Live demo:** https://pavanit1217.github.io/SysSim/

![System Design Simulator: a news feed design under a daily traffic wave](docs/screenshot.png)

## Features

- **Components:** Client, CDN, Load Balancer, Service, Cache, Queue, Database
  (primary + read replicas), External API, with capacity, instances, latency
  distribution, pool size, queue limits, timeouts, retries, hit ratio,
  autoscaling and more.
- **Hybrid simulation engine:** a rate-based flow layer (M/M/c queueing,
  backlogs, drops, timeouts, retry amplification) plus a sampled-request layer
  for p50/p95/p99 and request traces. It is deterministic for a given seed.
- **Traffic:** a log-scale slider from 1 to 100M req/s; steady, daily wave,
  flash spike and ramp profiles; adjustable read/write ratio.
- **Live view:** nodes coloured by utilisation, animated edges whose thickness
  follows the flow, charts for latency, throughput, error rate and utilisation,
  and a trace waterfall.
- **Chaos:** kill a node, add latency, flush a cache, trigger a retry storm.
- **Prep mode:** URL shortener, news feed and ticket flash-sale scenarios with goals.
- **Validation mode:** enter measured p50/p99 and capacity, or import a CSV of latency samples.
- **Persistence:** autosave, JSON import/export, and shareable links that carry
  the design in the URL hash.
- 100% client-side: no backend, no accounts.

## Quick start

Requirements: Node 22 (see `.nvmrc`) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Scripts

| Command        | What it does                                                  |
| -------------- | ------------------------------------------------------------- |
| `pnpm dev`     | Start the Vite dev server for the web app                     |
| `pnpm test`    | Run the Vitest suites (engine and web)                        |
| `pnpm check`   | Format check, lint, typecheck and test, as CI runs them       |
| `pnpm build`   | Build the engine and the production web app (`apps/web/dist`) |
| `pnpm preview` | Serve the production build locally                            |
| `pnpm format`  | Format everything with Prettier                               |

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app
and publishes it to GitHub Pages. The Vite `base` path is derived from the
repository name (`/<repo>/`); set `VITE_BASE` to override it, for example for a
custom domain. In the repository settings, Pages must use **GitHub Actions** as
its source; the workflow tries to enable this automatically.

`.github/workflows/ci.yml` runs format check, lint, typecheck, tests and build on
every push and pull request.

## Project layout

```
packages/engine   Pure TypeScript simulation engine (no DOM), Vitest tests
apps/web          Vite + React app (React Flow, Zustand, Recharts, Web Worker)
docs/             Requirements, architecture and ADRs
```

Read more in [docs/architecture.md](docs/architecture.md),
[docs/requirements.md](docs/requirements.md) and the ADRs in [docs/adr](docs/adr).
Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Using the engine directly

```ts
import { createDesign, createEdge, createNode, createSimulation } from '@syssim/engine';

const design = createDesign(
  'demo',
  [createNode('client', 'client'), createNode('api', 'service', undefined, { instances: 4 })],
  [createEdge('client', 'api')],
  { peakRps: 5_000 },
);
const sim = createSimulation(design, { seed: 7 });
const tick = sim.run(100); // 10 simulated seconds
console.log(tick.latency.p99, tick.errorRate, tick.nodes.api?.queueDepth);
```

## License

[MIT](LICENSE)
