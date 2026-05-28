# rooster Docs Index

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Architecture Overview](./01-architecture-overview.md) | Top-level system shape (server, client, Hermes bridge) |
| 02 | [Server Design](./02-server-design.md) | Hono routes, Socket.IO `/chat-run`, SQLite stores, bridge IPC |
| 03 | [Frontend Design](./03-frontend-design.md) | Preact + signals state model, components, streaming UI |
| 04 | [Communication Protocol](./04-communication-protocol.md) | REST + Socket.IO message shapes between client / server |
| 05 | [Implementation Roadmap](./05-implementation-roadmap.md) | Phase plan + delivery order |
| 06 | [WebSocket Protocol](./06-websocket-protocol.md) | `/chat-run` namespace events, lifecycle, error paths |
| 07 | [Phase 2 Status](./07-phase2-status.md) | Phase 2 (Chat Polish) completion + deferred items |
| 08 | [6DQ Improvement Plan](./08-6dq-improvement.md) | Tier-A roadmap (G2 / L2 / D1 / Hooks / CI) and post-upgrade assessment |

## Quality gates (current)

After Phase 5 of the 6DQ plan, the repo runs the following gates locally and in CI:

| Gate | Local hook | CI job | Where defined |
|------|------------|--------|---------------|
| G1 lint (`eslint --max-warnings 0`) | pre-commit | `quality` | `eslint.config.ts`, `package.json` |
| G1 typecheck (`tsc --noEmit`) | pre-commit | `quality` | `tsconfig.json`, `package.json` |
| L1 unit + coverage (≥95% br) | pre-commit | `quality` | `vitest.config.ts` |
| D1 isolation (static) | pre-commit | `coverage-gates` | `scripts/verify-test-isolation.ts` |
| L2 e2e (real `serve()` + `listen(0)`) | pre-push | `l2-e2e` | `packages/server/vitest.e2e.config.ts` |
| L2 route × method coverage (strict) | pre-push | `coverage-gates` | `scripts/check-route-coverage.ts` |
| G2 security (osv-scanner + gitleaks) | pre-push | `quality` | `scripts/run-security.ts` |

See [08-6dq-improvement.md §6](./08-6dq-improvement.md#6-acceptance-criteria-end-state-to-declare-tier-a) for the full acceptance criteria and [§11](./08-6dq-improvement.md#11-post-upgrade-assessment) for the shipped state.
