# Rooster

Personal web panel for a local Hermes Agent (streamed chat, sessions, SQLite).
Profile: ts-worker-web
Direction: [docs/01-architecture-overview.md](docs/01-architecture-overview.md). Frameworks must not rewrite this file.

## Sources of Truth

This file is the **contract**. Hooks, CI, and config are **enforcement**. If they disagree, that is a failure — raise enforcement to match this file; never lower the contract to a weaker hook.

| Fact | Where |
|---|---|
| Agent handbook | this file |
| Human docs | README.md, `docs/NN-*.md` |
| Version | omit at root; packages use `0.1.0` |
| Enforcement | `.husky/*`, `vitest.config.ts` 95%, `scripts/verify-test-isolation.ts`, CI |
| Machine rules | global `AGENTS.md`, `rules/git-commit.md` |
| Accidents | [Retrospective.md](Retrospective.md) |
| Env files | `HERMES_AGENT_ROOT`, `HERMES_AGENT_BRIDGE_PYTHON`, `HERMES_BRIDGE_SCRIPT`, `PORT`, `BIND_HOST`, `ROOSTER_DB_PATH` |

## Project Invariants

- Clean-room panel. Do not copy hermes-web-ui source; protocol only.
- No built-in auth. Bind `127.0.0.1` by default. Do not expose without an operator proxy.
- Default DB resolver `rooster.db` and `uploads/` in cwd are production-like. Tests must use `:memory:` or `os.tmpdir()` and pass `uploadsDir`.
- Bridge script is external (hermes-web-ui), not in this repo.
- `rebuild:native` may compile better-sqlite3 for this Node. Not a Cloudflare Worker.

## Stack / Layout

| Component | Choice |
|---|---|
| Language | TypeScript |
| Package manager | Bun workspace `packages/*` |
| Runtime | Vite client :7037 + Hono/Socket.IO :7038 |
| Lint | ESLint `--max-warnings 0` |
| Tests | Vitest L1 95%; L2 `packages/server/vitest.e2e.config.ts` |
| Data | better-sqlite3 (`ROOSTER_DB_PATH` / `rooster.db`) |

```
packages/server/src  packages/client/src
scripts/{dev-all,ensure-native,run-security,verify-test-isolation,check-route-coverage}.ts
```

MVVM: viewmodels have no View/DOM imports; routes stay thin.

## Commands

```bash
bun install
bun run rebuild:native      # better-sqlite3 for this Node
bun run dev                 # client+server (bridge already up)
bun run dev:all             # bridge + server :7038 + client :7037
bun run typecheck
bun run lint
bun run build
bun run test:coverage       # rebuild:native && vitest --coverage (95% four metrics)
bun run test:e2e            # HTTP/Socket.IO on temp port + memory DB + fake bridge
bun run gate:isolation      # scripts/verify-test-isolation.ts
bun run gate:routes         # check-route-coverage.ts --strict
bun run gate:security       # osv-scanner + gitleaks (binaries required)
bash scripts/test-bridge-lifecycle.sh
```

## Verification

Status: `enforced` | `planned` | `manual` | `N/A`.
6DQ = L1/L2/L3 + G1/G2 + D1.

| Change | Proof | Status | Evidence |
|---|---|---|---|
| Logic | L1 Vitest ≥ 95% four metrics | enforced | `vitest.config.ts`; pre-commit `test:coverage`; CI |
| API / schema | L2 real listen HTTP/Socket.IO 100% routes (`gate:routes` strict) | enforced | pre-push `test:e2e` + `gate:routes`; CI `l2-e2e` + coverage-gates |
| UI path | L3 browser Playwright | planned | README: no browser E2E command |
| Types / lint | G1 0 error, 0 warning | enforced | pre-commit lint+typecheck; CI |
| Deps / secrets | G2 osv-scanner + gitleaks; missing binary fails | enforced | pre-push `ensure-tools.sh` + `gate:security`; CI `security.yml` (secrets scan false there — pre-push still scans) |
| Test isolation | D1 memory/tmp DB + tmp uploads | enforced | `gate:isolation` + `setup-d1-guard.ts` (name is isolation, not Cloudflare D1) |
| Bundler output | `bun run build` | planned | not in pre-push |
| Docs | numbered docs if protocol changed | manual | human review |
| Release | none | N/A | unpublished personal panel |

| Hook | Verifies | Budget | Runs |
|---|---|---|---|
| pre-commit | working-tree lint, typecheck, `test:coverage`, `gate:isolation` (not `git checkout-index`) | target <30s (unmeasured) | G1 → L1 → D1 |
| pre-push | working-tree `test:e2e` + `gate:routes`; G2 binaries required (not stdin push refs) | target <3min (unmeasured) | L2 ‖ G2 |

Target: index-snapshot G1+L1; stdin-ref L2+G2. Check-only; `--no-verify` forbidden.

## Resources / Isolation

| Purpose | Port / resource | Isolation |
|---|---|---|
| Dev UI | 7037 | Vite proxy to 7038 |
| Dev API | 7038 (`PORT`) | SQLite cwd `rooster.db` unless `ROOSTER_DB_PATH` |
| L2 | ephemeral listen + `:memory:` | fake bridge; no Hermes credentials |
| Bridge | default 18765 | external process |

E2E never touches prod/daily `rooster.db` or `uploads/`.

## Operations / Release

No production deploy. Local panel only. Env table in README.

## Retrospective

| Kind | Where |
|---|---|
| Accident narrative | [Retrospective.md](Retrospective.md) |
| Project-specific rule that will recur | one line here (cap ~10) |
| Cross-project lesson | nmem / global `AGENTS.md` / `rules/` |
| Deterministically checkable rule | hook or test, not prose |

- Tests must not use literal `rooster.db` or default `uploads/`. Changing `PORT` requires updating the Vite proxy.
