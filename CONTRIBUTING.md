# Contributing

Thanks for helping improve SimLoad!

## Setup

```bash
nvm use            # Node 22 (see .nvmrc)
corepack enable    # provides the pinned pnpm version
pnpm install
pnpm dev           # http://localhost:5173
```

## Before you push

```bash
pnpm check   # prettier --check, eslint, tsc, vitest (all packages)
pnpm build   # must finish with zero warnings
```

CI runs the same steps on every push and pull request.

## Guidelines

- **Engine purity:** `packages/engine` has no DOM or UI dependencies. Export
  public API only from `packages/engine/src/index.ts`.
- **Tests first for engine changes:** add or extend a Vitest suite in
  `packages/engine/test`, ideally checked against a closed-form result.
- **Determinism:** all randomness goes through the seeded `Rng`. Never use `Math.random()` in the engine.
- **Small modules:** keep files under about 250 lines, use explicit exported types, and never use `any`.
- **Feature folders:** UI code goes in `apps/web/src/features/<feature>`;
  shared primitives in `ui/`, stores in `state/`.
- **Commits:** small and focused, with an imperative subject line
  (`feat(engine): ...`, `fix(web): ...`, `docs: ...`).

## Architecture decisions

Significant design choices are recorded in `docs/adr/`. Add a new numbered ADR
when you change something structural.
