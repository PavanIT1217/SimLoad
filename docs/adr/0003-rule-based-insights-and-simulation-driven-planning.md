# ADR 0003: Rule-based insights and simulation-driven capacity planning

- Status: Accepted
- Date: 2026-10-08

## Context

Users asked for two things: an explanation of _why_ a design fails, and help
finding _how much_ capacity it needs. The app must stay a static site with no
backend and no API keys.

Options considered:

1. An LLM-generated explanation and plan. This needs a server-side key or a
   user-supplied key, sends designs to a third party, and is not
   deterministic.
2. Closed-form sizing, e.g. `instances = λ / (μ · ρ_target)` per node. This is
   fast, but ignores interactions such as retries, timeouts, cache misses and
   failover.
3. Rules over the simulation's own numbers for explanations, and search over
   the simulator itself for planning.

## Decision

Use option 3:

- **`diagnose()`** is a pure function of the design and one tick. Each rule
  reads quantities the engine already computes (ρ, λ, μ, backlog, timeout and
  retry rates, hit ratios) and phrases a finding with concrete numbers.
- **`planCapacity()`** treats the simulator as the oracle. It repeatedly
  simulates at the target load, grows the bottleneck, then trims back.
  Requiring ρ ≤ 0.9 keeps plans from sitting at 100% utilisation.

## Consequences

- Explanations and plans are deterministic, private and run offline, in the
  browser.
- Plans account for second-order effects (retry storms, timeouts, read/write
  splits) because they come from the same model the user is watching.
- A plan takes 10–60 short simulations (well under a second to a few seconds)
  and runs in its own worker so the live simulation stays smooth.
- Rules need upkeep when new component behaviour is added; tests pin the most
  important ones.
