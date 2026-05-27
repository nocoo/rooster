# 08 — 6DQ Improvement Plan

> Bring rooster up to the nocoo six-dimension quality (6DQ) rubric so it can join
> the managed-repo register (currently 40 repos as of 2026-05-05, e.g. `bat`,
> `ellie`, `raven`, `pew`).
>
> **Scope of this doc**: assessment + gap analysis + actionable improvement
> proposal. Code changes are **not** part of this document — this is a review
> artifact for SD-Reviewer-B.
>
> **L3 (browser E2E) is intentionally excluded** from the required scope per
> upstream direction. We still record it for completeness but do not gate on it.

---

## 1. 6DQ Rubric (Reference)

Authoritative source: nmem memory `nocoo-6dq-score-log` (2026-05-07 全量重评).

| Dim | Name | Definition | Tool / Where it runs |
|-----|------|------------|----------------------|
| **L0** | Executable carrier | `dev` / `build` / `start` actually work end-to-end | manual + CI smoke |
| **L1** | Unit tests | Logic + pure functions, branch coverage **≥ 80%** (rooster target 95%) | `vitest run --coverage` |
| **L2** | Integration tests | Real HTTP / IPC E2E hitting the bound dependency, **route × method coverage gate** | `vitest` against real Hono listen + real socket |
| **L3** | System / browser E2E | Playwright on a running stack | `playwright test` (**excluded from this round**) |
| **G1** | Static analysis | 0 error + 0 warning, strict rules + typecheck | `eslint --max-warnings 0` + `tsc --noEmit` |
| **G2** | Security gate | Dependency CVE scan + secrets leak scan | `osv-scanner` + `gitleaks` |
| **D1** | Test isolation | Test resources physically separated from dev/prod (≥ 2 layers of validation) | `[env.test]` / `_test_marker` / `verify-test-bindings` |

### Tier mapping

| Tier | Definition |
|------|------------|
| **S** | All applicable dimensions ✅ |
| **A** | Missing only L3 |
| **B** | L0 + L1 + G1 baseline only |
| **C** | L1 not meeting threshold or broken gates |

> rooster's realistic immediate target = **Tier A** (S minus L3). Tier S is
> deferred until L3 Playwright work is sanctioned separately.

---

## 2. Baseline Reference — `../bat` (Tier S)

`bat` is on the 6DQ managed list at Tier S (2026-05-07: 1627 tests, all 6 dims
green, hosts both Rust probe + CF Worker). It is the closest stack analogue
to rooster among Tier-S repos for the *tooling layout* (bun workspaces, vitest,
husky, lint-staged) — we use it as the reference pattern.

### bat's 6DQ shape

| Dim | bat implementation |
|-----|---------------------|
| L0 | `bun run dev` / `bun run build` / `bun run deploy` |
| L1 | `vitest run --coverage` per-package, root `scripts/check-coverage.sh` enforces threshold; **fails** instead of skipping when no coverage data is found |
| L2 | `wrangler.test.ts` real HTTP on `:18787`, plus `scripts/check-route-coverage.ts` static gate ensuring **every** route × method is hit by an L2 test |
| L3 | Playwright in `packages/ui` (out of our scope) |
| G1 | `biome check --error-on-warnings .` + `tsc --noEmit` via `turbo typecheck`; `lint-staged` on pre-commit |
| G2 | `scripts/run-security.ts` runs `osv-scanner --lockfile=bun.lock` **and** `osv-scanner --lockfile=probe/Cargo.lock` **and** `gitleaks git --log-opts=@{u}..HEAD` |
| D1 | `[env.test]` binding to `bat-db-test` + `scripts/verify-test-bindings.ts` (asserts `-test` suffix on every test DB) + `_test_marker` migration |

### bat's hook shape

```
pre-commit (.husky/pre-commit):
  G1: turbo typecheck → lint-staged → (rust) cargo fmt --check + cargo clippy -D warnings
  L1: scripts/check-coverage.sh 90 95

pre-push (.husky/pre-push):
  Run in PARALLEL with fail-fast:
    L2: bun turbo test:e2e --filter=@bat/worker
    G2: bun run gate:security    # osv-scanner + gitleaks
```

### bat's CI shape (`.github/workflows/ci.yml`)

Five parallel jobs:

1. `quality` — reuses `nocoo/base-ci/.github/workflows/bun-quality.yml@v2026.1`
   (L1 + G1 + G2 in one shared workflow)
2. `coverage-gates` — static route + page coverage gates (no runtime)
3. `l2-e2e` — local wrangler E2E (`@bat/worker`)
4. `l3-playwright` — Playwright on `@bat/ui`
5. `probe` — `cargo test` + `cargo clippy -D warnings` + `cargo fmt --check`

> rooster does not have a wrangler/CF surface, so we map (3) to the Hono server
> integration layer instead of wrangler. (1), (2), (5) translate directly.

---

## 3. Rooster Current State (Audit)

Repo root: `/Users/nocoo/workspace/personal/rooster` @ `5fc4ca3` on `main`,
default branch `main`, origin `github.com/nocoo/rooster.git`.

### 3.1 What's already in place ✅

| Dim | Evidence |
|-----|----------|
| **L0** | `package.json` exposes `dev` / `build` / `start` per package. `scripts/dev-all.sh` boots full stack. |
| **L1** | `vitest.config.ts` v8 coverage @ **95 / 95 / 95 / 95** thresholds (lines/functions/branches/statements). Per `docs/07-phase2-status.md`: 572 tests, branch 95.4%, statement 98.63%. |
| **G1** | `eslint.config.ts` uses `tseslint.configs.strictTypeChecked` + `no-explicit-any: error` + `consistent-type-imports: error`. Root `lint` script: `eslint . --max-warnings 0`. Root `typecheck`: `tsc -p server --noEmit && tsc -p client --noEmit && tsc --noEmit`. |
| **L2** (partial) | `packages/server/tests/server-bootstrap.test.ts` already does `server.httpServer.listen(0)` + `fetch('http://localhost:${port}/health')` — real HTTP. `chat-run.test.ts` boots a real Socket.IO server. |
| **D1** (partial) | All DB tests use `:memory:` SQLite via `createDb(':memory:')`. File-mode tests write to `/tmp/rooster-test-<pid>.db` and `unlink` on teardown. |

### 3.2 Gaps ❌

| Dim | Gap | Impact |
|-----|-----|--------|
| **L2** | No dedicated `test:e2e` script and no `gate:routes` style coverage check. Real-HTTP tests are scattered inside the unit-test pool, mixed with mocks. Route × method coverage is **not measured**. | Tier S blocker. Can pass overall test count but silently miss routes. |
| **G2** | **Zero** security tooling. No `osv-scanner`, no `gitleaks`, no `gate:security` script. `bun.lock` exists (perfect input for `osv-scanner v2`) but is never scanned. | Tier B downgrade. CVE-laden deps could ship undetected. |
| **D1** | In-memory + `/tmp` *do* isolate runtime, but there is **no validation script** asserting tests never touch a persisted dev DB path. No `_test_marker` style guard. No banned-path check (e.g. test must not write to `~/.rooster/` or whatever the prod path is). Single layer of isolation only. | Counts as ⚠️, not ✅. 6DQ requires ≥ 2 verified layers. |
| **Hooks** | `.husky/pre-commit` only — runs `lint && typecheck && test:coverage`. **No `.husky/pre-push`** exists at all. G2 + heavy L2 should live there. | Local guard rail missing. Bad pushes possible from local. |
| **CI** | **No `.github/workflows/`** exists in the repo. All quality work runs only on developer machines. | Hard Tier-C signal — managed repos must have CI. |
| **L3** | No Playwright, no browser tests. | **Out of scope for this round.** Acceptable as ❌ for now, drop us to Tier A max. |
| **License/Compliance footnote** | `LICENSE` exists; `trustedDependencies: ["better-sqlite3"]` is declared cleanly. No nit here, just recording. | — |

### 3.3 Current Tier

`L0 ✅  L1 ✅  L2 ⚠️  L3 ❌  G1 ✅  G2 ❌  D1 ⚠️` → **Tier B** (L0+L1+G1
baseline met, L2/D1 partial, G2 missing, no CI).

---

## 4. Improvement Plan

Goal: reach **Tier A** (S minus L3) without changing product code. Everything
below is tooling, gates, and tests — no `src/` business-logic edits.

The plan is broken into 6 atomic, independently shippable phases. Each phase
maps to one commit (or a tight commit group) and one PR-equivalent landing.

### Phase 1 — G2 Security gate (CVE + secrets)

**Why first**: cheapest, highest-value, no test dependencies. Closes the worst
current gap.

| Item | Detail |
|------|--------|
| Add | `scripts/run-security.ts` modeled on `bat/scripts/run-security.ts` (osv-scanner on `bun.lock`, gitleaks `@{u}..HEAD`). |
| Add | `osv-scanner.toml` at repo root (start empty — only add ignore entries as needed with rationale). |
| Add | `package.json` root script `gate:security`: `bun run scripts/run-security.ts`. |
| Add | `scripts/ensure-tools.sh` (or inline check) — verify `osv-scanner` and `gitleaks` are installed, print install hint if not. |
| Wire | new `.husky/pre-push` invoking `gate:security`. |
| Docs | Update root `README.md` (or this doc) with install hint: `brew install osv-scanner gitleaks`. |

**Acceptance**: `bun run gate:security` exits 0 on a clean tree; exits non-zero
when `bun.lock` contains a known CVE or when a staged commit between
`@{u}..HEAD` contains a secret pattern.

**Commits** (atomic):
1. `feat(scripts): add G2 security gate (osv-scanner + gitleaks)`
2. `chore(husky): add pre-push running G2 gate`

---

### Phase 2 — L2 layer separation + route × method coverage gate

**Why second**: Tier S requires every HTTP/Socket.IO route to have an L2 test
hit. We have real-HTTP tests but no proof they cover the surface.

| Item | Detail |
|------|--------|
| Refactor (test-tree only, no `src/`) | Move real-HTTP integration tests out of `packages/server/tests/` into `packages/server/tests/e2e/` (`*.e2e.test.ts`). Pure-mock unit tests stay where they are. |
| Add | `packages/server/vitest.e2e.config.ts` — separate config that only loads `*.e2e.test.ts`, no coverage thresholds (L2 doesn't gate coverage; L2 gates route hits). |
| Add | `package.json` script `test:e2e`: `vitest run -c packages/server/vitest.e2e.config.ts`. |
| Add | `scripts/check-route-coverage.ts` — static analyzer that walks `packages/server/src/routes/**` for `.get/.post/.put/.delete/.patch` calls, then walks `packages/server/tests/e2e/**` for matching `fetch(... method: 'POST')` calls; **fails** if any route × method is uncovered. Modeled on `bat/scripts/check-route-coverage.ts`. |
| Add | `package.json` script `gate:routes`: `bun run scripts/check-route-coverage.ts`. |
| Wire | extend `.husky/pre-push` to run `test:e2e` + `gate:routes` in **parallel** with `gate:security` (fail-fast). |

**Current route surface to cover** (sourced from `src/routes/`):

```
GET    /api/health
GET    /api/bridge/profiles
GET    /api/bridge/models
GET    /api/bridge/providers
POST   /api/uploads
GET    /api/uploads/:id
GET    /api/sessions
GET    /api/sessions/search
GET    /api/sessions/conversations
GET    /api/sessions/conversations/:id/messages
GET    /api/sessions/conversations/:id/messages/paginated
GET    /api/sessions/hermes
GET    /api/sessions/hermes/:id
GET    /api/sessions/:id
GET    /api/sessions/:id/export
DELETE /api/sessions/:id
POST   /api/sessions/:id/rename
…
```

Plus Socket.IO namespaces (`/chat-run`). The route-coverage script must extend
to socket events (event-name × emit/listen pair).

**Acceptance**: `bun run gate:routes` lists current uncovered route × method
pairs (initial baseline may be > 0 — record it). Pre-push refuses to push if
the list is non-empty. Backfill tests until empty.

**Commits**:
1. `refactor(server/tests): split e2e tests into tests/e2e/ tree`
2. `feat(scripts): add L2 route × method coverage gate`
3. `chore(husky): wire test:e2e + gate:routes into pre-push`

---

### Phase 3 — D1 Isolation guard (second validation layer)

**Why third**: `:memory:` and `/tmp` are layer 1 (physical separation). 6DQ
asks for a second, programmatic guard.

| Item | Detail |
|------|--------|
| Add | `scripts/verify-test-isolation.ts` — static + runtime guard: (a) scans test files for any `createDb(` call whose arg is not `':memory:'` or a `/tmp/...` pattern; (b) at vitest setup, fails fast if process detects DB path under `~/.rooster/` or `$HOME/Library/Application Support/rooster/` (the prod path family). |
| Add | `packages/server/tests/setup-d1-guard.ts` — vitest setupFile that hooks `process.env` and asserts no prod DB path is set during tests. |
| Wire | `vitest.config.ts` `setupFiles: ['packages/server/tests/setup-d1-guard.ts']`. |
| Add | `package.json` script `gate:isolation`: `bun run scripts/verify-test-isolation.ts`. |
| Wire | add to `.husky/pre-commit` (cheap static check). |

**Acceptance**: `bun run gate:isolation` exits 0. If anyone adds
`createDb('/Users/...')` to a test, the gate fails before commit.

**Commits**:
1. `feat(scripts): add D1 isolation guard (static + runtime)`
2. `chore(husky): wire gate:isolation into pre-commit`

---

### Phase 4 — Hooks alignment (L1+G1 / L2+G2+routes)

**Why fourth**: ratify the hook contract after Phases 1–3 are in.

Target shape:

```
pre-commit:
  G1: bun run lint            # eslint --max-warnings 0 (already)
  G1: bun run typecheck       # tsc strict (already)
  L1: bun run test:coverage   # vitest + v8 ≥ 95% (already)
  D1: bun run gate:isolation  # NEW from Phase 3

pre-push:
  L2: bun run test:e2e        # NEW from Phase 2
  L2: bun run gate:routes     # NEW from Phase 2
  G2: bun run gate:security   # NEW from Phase 1
  (run in parallel, fail-fast)
```

This consolidates the husky pieces written across Phases 1–3 into one canonical
hook layout that matches `bat`'s pattern.

**Commits**:
1. `chore(husky): canonicalize pre-commit / pre-push to 6DQ layout`

---

### Phase 5 — CI workflows (`.github/workflows/`)

**Why fifth**: rooster has *no* CI today; this is the single largest reason it
cannot join the managed list. Mirror `bat/.github/workflows/ci.yml` but
adapted to a non-Cloudflare Hono stack.

Proposed jobs (all parallel, fail-fast at job level):

| Job | What it runs | Maps to |
|-----|--------------|---------|
| `quality` | `nocoo/base-ci/.github/workflows/bun-quality.yml@v2026.1` with `pre-command` building native (`tsx scripts/ensure-native.ts`) | L1 + G1 + G2 |
| `coverage-gates` | `bun run gate:routes` + `bun run gate:isolation` | L2 (static) + D1 |
| `l2-e2e` | `bun install` → `tsx scripts/ensure-native.ts` → `bun run test:e2e` | L2 (runtime) |
| `(deferred) l3-e2e` | placeholder; not added this round | L3 (out of scope) |

Notes:
- `bun-quality.yml` already handles `osv-scanner` + `gitleaks` per the bat
  pattern, so the security gate runs in CI even though it is *also* a local
  pre-push hook. Both are desirable: pre-push catches the offender; CI catches
  bypassed pushes.
- `pre-command` must rebuild `better-sqlite3` native bindings because the lockfile
  is installed with `--ignore-scripts`. Mirror bat's approach (loop over
  `trustedDependencies` and run `bun run install`).

**Acceptance**: PR to `main` runs all 3 jobs; all green on `5fc4ca3`-equivalent
baseline (post-Phases 1–3).

**Commits**:
1. `ci: add .github/workflows/ci.yml (L1+G1+G2 quality, coverage gates, L2 e2e)`

---

### Phase 6 — Docs + index update

| Item | Detail |
|------|--------|
| Add | `docs/README.md` (if missing) index pointing to this doc and the existing 01–07 series. |
| Update | `docs/07-phase2-status.md` — append note that 6DQ Tier A was achieved post-Phase 5 (link to this doc). |
| Update | This doc — fill in the *Post-Upgrade Assessment* table once Phases 1–5 ship. |

**Commits**:
1. `docs(6dq): add index + cross-link phase status to 6DQ improvement plan`

---

## 5. Per-Dimension Gap → Action Map

| Dim | Today | After plan | Phase | Effort (rough) |
|-----|-------|------------|-------|---------------|
| L0 | ✅ | ✅ | — | — |
| L1 | ✅ (95.4% branch) | ✅ | — | — |
| L2 | ⚠️ scattered HTTP tests, no route gate | ✅ dedicated `test:e2e`, `gate:routes` zero-uncovered | 2 | M (backfill tests for any uncovered route × method) |
| L3 | ❌ | ❌ (out of scope) | — | — |
| G1 | ✅ | ✅ | — | — |
| G2 | ❌ | ✅ osv-scanner + gitleaks, pre-push + CI | 1 | S |
| D1 | ⚠️ single layer | ✅ static + runtime guard | 3 | S |
| Hooks | partial | canonical 6DQ shape | 4 | XS |
| CI | ❌ | ✅ 3 parallel jobs | 5 | M |

Total: 1 small + 2 medium + 4 small/XS phases. Realistic single-sprint scope.

---

## 6. Acceptance Criteria (end state to declare "Tier A")

All of the following must hold on `main` for ≥ 1 green CI run:

1. `bun run lint` → exit 0, 0 warnings.
2. `bun run typecheck` → exit 0.
3. `bun run test:coverage` → exit 0, ≥ 95 / 95 / 95 / 95.
4. `bun run test:e2e` → exit 0.
5. `bun run gate:routes` → exit 0 (every route × method has ≥ 1 e2e hit).
6. `bun run gate:security` → exit 0 (osv + gitleaks both clean).
7. `bun run gate:isolation` → exit 0.
8. `.husky/pre-commit` and `.husky/pre-push` exist and chain the gates above.
9. `.github/workflows/ci.yml` exists; `quality`, `coverage-gates`, `l2-e2e`
   jobs all pass on the latest `main` commit.

If 1–9 hold, rooster's row in `nocoo-6dq-score-log` becomes:
`L0:✅ L1:✅ L2:✅ L3:❌ G1:✅ G2:✅ D1:✅` → **Tier A** ✅.

L3 → Tier S is a separate, deferred decision.

---

## 7. Non-Goals (explicitly out)

- **L3 Playwright browser tests.** Per upstream direction, not in scope.
- **Code changes under `packages/*/src/**`.** This plan is purely tooling /
  tests / gates / CI. If a route turns out to be untestable as-is, that becomes
  a separate small refactor PR tracked outside this plan.
- **Migrating off `bun`** or off vitest / eslint. Tooling choices stay.
- **Coverage threshold tuning.** Current 95 is already above bat's 90; we keep
  it.
- **Joining the 6DQ managed-repo register itself.** That is an
  `nocoo-6dq-score-log` edit, owned by zheng-li, post-merge.

---

## 8. Self-Audit (what could be wrong about this plan)

Recording the spots most likely to be off so SD-Reviewer-B can target review:

1. **Route × method gate over Hono regex routes.** `gate:routes` must
   understand Hono's path params (`:id`) and matching test calls
   (`fetch('/api/sessions/abc')` matches `:id`). Bat's script targets static
   Worker bindings; the rooster port may need a richer matcher.
2. **Socket.IO L2 coverage.** Bat is a pure HTTP worker. Rooster has a
   `/chat-run` namespace. The plan claims to extend `gate:routes` to socket
   events but doesn't yet specify the API for "covered event". Open question.
3. **`base-ci/.github/workflows/bun-quality.yml@v2026.1` compatibility.** I
   assume it accepts a node-style server stack (Hono + better-sqlite3) the same
   way it accepts CF Worker stacks. May need a `pre-command` step for native
   rebuild that does not exist in bat (bat uses workerd, not better-sqlite3).
4. **`/tmp` writes vs CI.** `db.test.ts` writes to `/tmp/rooster-test-${pid}.db`.
   CI runners' `/tmp` is fine, but multi-runner parallel matrices could
   collide. Plan implicitly assumes single-runner per job; if matrix runs are
   added, switch to `os.tmpdir()` + `mkdtemp`.
5. **`exactOptionalPropertyTypes`.** Per `docs/07`, the project uses it.
   `--max-warnings 0` already enforces this, but if any of the new test scaffolds
   touch `?:` typing in trickier ways, they may surface fresh G1 violations.
   Not a blocker; just a watch-out during implementation.
6. **D1 prod path detection.** The plan names `~/.rooster/` and
   `$HOME/Library/Application Support/rooster/` as banned prod paths in the
   runtime guard. The actual prod path needs to be verified against the
   server's resolver before the guard is written.

---

## 9. Open Questions for SD-Reviewer-B

1. Is the **L3 deferral** the standing position or only for this sprint? Affects
   whether `Phase 5` CI should include a stub `l3-playwright` job (off by
   default, `workflow_dispatch`) so it's wired but not gating.
2. Should `gate:security` use `osv-scanner v2` with `--lockfile=bun.lock` (bun
   v1.3+ lockfile format) — or are we still on a bun version that emits an
   older lockfile osv-scanner can't read? (Quick check: `bun --version` on
   current rooster CI baseline.)
3. For the route-coverage gate, do we want the **failing route list** to be
   committed as a baseline (`docs/route-coverage-baseline.json`) so the first
   pre-push doesn't block the very PR that adds the gate? Bat shipped it
   already-clean; rooster will likely have a non-empty initial backlog.
4. Native `better-sqlite3` rebuild step: keep `scripts/ensure-native.ts` as-is
   (it's already a real script), or shift to bat's pattern of explicit
   `--ignore-scripts` install + per-package `bun run install` in CI? The former
   is simpler; the latter is more auditable.

---

## 10. Appendix — Tool Install Hints

```bash
# G2 tooling (one-time, macOS)
brew install osv-scanner   # v2+ required for bun.lock
brew install gitleaks
```

```bash
# Verify wired-up
bun run gate:security    # osv ✔ + gitleaks ✔
bun run gate:routes      # route × method coverage
bun run gate:isolation   # D1 second layer guard
bun run test:e2e         # L2 runtime
```

---

*Maintainer of this doc: SD-SDE-B. Review pair: SD-Reviewer-B. Source of truth
for rubric: nmem memory `nocoo-6dq-score-log` (2026-05-07).*
