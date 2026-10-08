# ADR 0002: Hybrid flow + sampled simulation

- Status: Accepted
- Date: 2026-10-08

## Context

Traffic spans 1 to 100,000,000 req/s. A discrete-event simulation of every
request costs work proportional to the request rate, which is impossible at
earth scale in a browser. A purely analytical (fluid) model is cheap, but it
cannot produce latency distributions, percentiles or request traces, and it
hides per-request behaviour such as retries and cache hits.

## Decision

Combine two layers each tick:

1. **Flow layer:** request _rates_ move through the DAG. Fluid queues with
   backlog and drops, an M/M/c (Erlang C or Sakasegawa) waiting-time estimate,
   and a backward pass for end-to-end success, latency and timeouts. Retries
   feed back with a one-tick lag, so retry storms emerge from the dynamics.
2. **Sample layer:** a fixed number of individual requests (200 by default)
   walk the graph using the flow layer's state: queue waits, drop and error
   probabilities, and hit ratios. Service times are lognormal. Samples give the
   percentiles and traces.

All randomness comes from one seeded PRNG.

## Consequences

- Cost per tick is O(nodes + samples × path length), regardless of load.
- Error rates come from the flow layer, so rates like 0.001% are exact rather than limited by the sample count.
- Percentiles from 200 samples per tick are noisy, so we pool a rolling window
  of 10 ticks (about 2,000 samples).
- Approximations: classes share pool capacity in proportion to demand; timeout
  estimates treat downstream latency as its mean; work for requests that timed
  out still consumes capacity. These trade fidelity for speed and are covered
  by tests against closed-form results.
