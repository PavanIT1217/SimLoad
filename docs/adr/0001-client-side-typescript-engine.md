# ADR 0001: Client-side TypeScript engine (over Blazor WebAssembly)

- Status: Accepted
- Date: 2026-10-08

## Context

The simulator must run fully in the browser and deploy as a static site to
GitHub Pages. We considered:

1. A **TypeScript** engine running in a Web Worker.
2. A **C# engine on Blazor WebAssembly**, with the UI in Blazor or React via JS interop.

## Decision

Write the engine in strict TypeScript as a standalone package
(`@syssim/engine`) with no DOM dependencies, and run it in a Web Worker.

## Consequences

- **Payload:** the engine is about 20 kB in the worker bundle. Blazor WASM ships
  a .NET runtime of several MB, which hurts first load on Pages.
- **One language and toolchain:** shared types between the engine, the worker
  protocol and the UI. One test runner (Vitest), one linter, one build.
- **Ecosystem:** React Flow and Recharts are first-class in TypeScript. With
  Blazor we would either give them up or pay for JS interop on every frame.
- **Performance:** the hybrid model (ADR 0002) keeps work per tick O(nodes +
  samples), independent of request rate, so JIT-compiled JS is fast enough.
  WASM's raw-compute advantage is not needed.
- **Trade-off:** no compile-time units of measure or value types. We rely on
  naming (`Rps`, `Ms`) and tests instead.
