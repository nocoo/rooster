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
| **L2** | Integration tests | Real HTTP / IPC E2E hitting the bound dependency, **route × method coverage gate**. **In-memory `app.request(...)` does NOT count** — must be real `http.Server.listen(0)` + real `fetch` / `socket.io-client` | `vitest` against real Hono `serve()` listen + real socket |
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

### bat's hook shape (verified against `bat/.husky/*` on 2026-05-28)

```
pre-commit (.husky/pre-commit) — parallel, fail-fast:
  G1: turbo typecheck
  G1: lint-staged (biome --error-on-warnings on staged files)
  G2: gitleaks protect --staged --no-banner       # staged-only secret scan
  L1: scripts/check-coverage.sh 90 95
  L2 (static): gate:routes                         # static route × method coverage
  L3 (static): gate:pages                          # static page coverage
  (rust) cargo fmt --check + cargo clippy -D warnings   # only if probe/ changed

pre-push (.husky/pre-push) — parallel, fail-fast:
  L2: bun turbo test:e2e --filter=@bat/worker
  G2: bun run gate:security    # osv-scanner (bun.lock + Cargo.lock) + gitleaks @{u}..HEAD
```

Notes:
- bat runs **two flavors** of gitleaks (staged at commit time, range
  `@{u}..HEAD` at push time). Both are valuable; rooster should adopt the
  push-time variant first (cheaper to wire) and add staged later.
- `gate:routes` runs **statically** at pre-commit in bat — no HTTP boot.
  rooster can do the same once the script lands.

### bat's CI shape (`.github/workflows/ci.yml`)

Five parallel jobs:

1. `quality` — reuses `nocoo/base-ci/.github/workflows/bun-quality.yml@v2026.1`
   (L1 + G1 + G2 in one shared workflow)
2. `coverage-gates` — static route + page coverage gates (no runtime)
3. `l2-e2e` — local wrangler E2E (`@bat/worker`)
4. `l3-playwright` — Playwright on `@bat/ui`
5. `probe` — `cargo test` + `cargo clippy -D warnings` + `cargo fmt --check`

> **What translates to rooster, what does not.** rooster has no CF Worker /
> wrangler surface and no Rust probe, so:
> - `quality` (1) — borrow the contract (L1 + G1 + G2 in one job), but call
>   it directly; `base-ci/bun-quality.yml@v2026.1`'s exact compatibility with a
>   `better-sqlite3`-backed Hono stack must be verified (see open question §9).
> - `coverage-gates` (2) — borrow the *shape* (static gates, no runtime). Drop
>   `gate:pages` — rooster has no SSR/page tree; only `gate:routes` applies.
> - `l2-e2e` (3) — replace wrangler with a real `@hono/node-server` listen +
>   real `fetch` / `socket.io-client`. This is the rooster L2 runtime.
> - `l3-playwright` (4) — **do not port.** L3 is explicitly out of scope and we
>   do not add a stub job (no `workflow_dispatch` placeholder either).
> - `probe` (5) — **do not port.** rooster has no Rust component.

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
| **L2** (partial) | `packages/server/tests/server-bootstrap.test.ts` already does `server.httpServer.listen(0)` + `fetch('http://localhost:${port}/health')` — real HTTP. `chat-run.test.ts` boots a real Socket.IO server. **However** the unit-test pool is dominated by `app.request(...)` in-memory calls, which are not L2-grade per §1. |
| **D1** (partial) | DB resolver is `path ?? process.env.ROOSTER_DB_PATH ?? 'rooster.db'` (`packages/server/src/services/hermes/db.ts:107`). Uploads default to `process.cwd()/uploads` (`packages/server/src/app.ts:23`). Tests use `createDb(':memory:')`; `db.test.ts` writes `/tmp/rooster-test-<pid>.db` and `unlink`s on teardown. **No** `~/.rooster/` or `~/Library/Application Support/rooster/` path is used by the resolver — those are not the prod path family. |

### 3.2 Gaps ❌

| Dim | Gap | Impact |
|-----|-----|--------|
| **L2** | No dedicated `test:e2e` script and no `gate:routes` style coverage check. Real-HTTP tests are scattered inside the unit-test pool, mixed with `app.request(...)` in-memory calls that don't qualify as L2. Route × method coverage is **not measured**. | Tier S blocker. Can pass overall test count but silently miss routes. |
| **G2** | **Zero** security tooling. No `osv-scanner`, no `gitleaks`, no `gate:security` script. `bun.lock` exists (perfect input for `osv-scanner v2`) but is never scanned. | Tier B downgrade. CVE-laden deps could ship undetected. |
| **D1** | `:memory:` + `/tmp/rooster-test-<pid>.db` provide layer-1 physical separation, but there is **no validation script** asserting tests never bind to the actual resolver default (`rooster.db` at `process.cwd()`) or to a caller-supplied `ROOSTER_DB_PATH`. The resolver is `path ?? ROOSTER_DB_PATH ?? 'rooster.db'`; uploads default to `process.cwd()/uploads`. Single layer of isolation only. | Counts as ⚠️, not ✅. 6DQ requires ≥ 2 verified layers. |
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

**Why second**: Tier S requires every HTTP / Socket.IO route to have an L2 test
hit. We have real-HTTP tests but no proof they cover the surface.

**L2 definition (strict)**: an L2 test must boot a real `http.Server` via
`@hono/node-server` `serve()` on an ephemeral port (`listen(0)`) and call it
through real `fetch` (or, for sockets, real `socket.io-client`). In-memory
`app.request(...)` calls are *not* L2 — they bypass the HTTP layer and don't
exercise content negotiation, status code wire format, or socket handshake.
They stay where they are (unit / integration-lite); they do not count toward
route coverage.

| Item | Detail |
|------|--------|
| Refactor (test-tree only, no `src/`) | Move real-`listen()` integration tests into `packages/server/tests/e2e/` (`*.e2e.test.ts`). `app.request(...)`-based tests stay under `tests/` as unit/integration-lite — they are not L2. |
| Add | `packages/server/vitest.e2e.config.ts` — separate config that only loads `*.e2e.test.ts`, no coverage thresholds (L2 doesn't gate coverage; L2 gates route hits). |
| Add | `package.json` script `test:e2e`: `vitest run -c packages/server/vitest.e2e.config.ts`. |
| Add | `scripts/check-route-coverage.ts` — static analyzer that walks `packages/server/src/routes/**` for `.get/.post/.put/.delete/.patch` calls (resolving each sub-router's mount prefix from `app.ts`), then walks `packages/server/tests/e2e/**` for matching `fetch(url, { method })` / `socket.emit(event)` calls; **fails** if any route × method is uncovered. Modeled on `bat/scripts/check-route-coverage.ts` but extended for Hono `:id` params and Socket.IO events. |
| Add | `package.json` root script `gate:routes`: `bun run scripts/check-route-coverage.ts`. |
| Wire | extend `.husky/pre-push` to run `test:e2e` + `gate:routes` in **parallel** with `gate:security` (fail-fast). |

**Current route surface** (verified from `packages/server/src/app.ts` mount
table + each sub-router; all `routes.*` calls resolved against their mount
prefix on 2026-05-28):

```
GET    /health                                                # routes/health.ts
GET    /api/hermes/search/sessions                            # routes/sessions.ts createSearchRoutes
GET    /api/hermes/sessions                                   # routes/sessions.ts createSessionRoutes "/"
GET    /api/hermes/sessions/search                            # routes/sessions.ts (inner /search)
GET    /api/hermes/sessions/conversations                     # routes/sessions.ts
GET    /api/hermes/sessions/conversations/:id/messages
GET    /api/hermes/sessions/conversations/:id/messages/paginated
GET    /api/hermes/sessions/hermes                            # nested /hermes inside createSessionRoutes
GET    /api/hermes/sessions/hermes/:id
GET    /api/hermes/sessions/:id/export
GET    /api/hermes/sessions/:id
DELETE /api/hermes/sessions/:id
POST   /api/hermes/sessions/:id/rename
GET    /api/hermes/profiles                                   # routes/bridge.ts (mounted at /api/hermes)
GET    /api/hermes/models
GET    /api/hermes/providers
POST   /api/upload                                            # routes/upload.ts "/"
GET    /api/upload/:id
```

Plus Socket.IO `/chat-run` namespace events (event-name × emit/listen pair).
The route-coverage script must enumerate both HTTP and socket surfaces.

> **Open watch-out**: two `GET` routes resolve to the same path
> `/api/hermes/sessions/search` — once from `createSearchRoutes` (mounted at
> `/api/hermes/search`, handler `/sessions`) and once from inside
> `createSessionRoutes` (mounted at `/api/hermes/sessions`, handler
> `/search`). Different paths in fact:
> `/api/hermes/search/sessions` vs `/api/hermes/sessions/search`. Both listed
> above. The route-coverage script must treat them as distinct.

**Acceptance & report-mode strategy**: do **not** commit a failing baseline.
Phase 2 lands in two sub-commits:
1. `gate:routes` ships in **report mode** (prints uncovered route × method,
   always exits 0) — same commit as the script.
2. Backfill e2e tests until the report is empty, then a follow-up sub-commit
   flips the script to **strict mode** (`exit 1` on any uncovered entry) and
   wires it into pre-push / CI.

`main` must never carry a "permit uncovered" baseline file.

**Commits**:
1. `refactor(server/tests): split e2e tests into tests/e2e/ tree`
2. `feat(scripts): add L2 route × method coverage gate in report mode`
3. `test(server/e2e): backfill e2e coverage to zero uncovered`
4. `feat(scripts): flip gate:routes to strict; chore(husky): wire into pre-push`

---

### Phase 3 — D1 Isolation guard (second validation layer)

**Why third**: `:memory:` and `/tmp/rooster-test-<pid>.db` are layer 1
(physical separation). 6DQ asks for a second, programmatic guard.

**Actual resolver to defend against** (verified):

- `packages/server/src/services/hermes/db.ts:107`:
  `const dbPath = path ?? process.env['ROOSTER_DB_PATH'] ?? 'rooster.db'`
- `packages/server/src/app.ts:23`:
  `const uploadsDir = deps.uploadsDir ?? join(process.cwd(), 'uploads')`

So the *prod-like* paths that tests must never bind to are:
1. The literal default `'rooster.db'` (resolves to `process.cwd()/rooster.db`).
2. Any `ROOSTER_DB_PATH` env value set in the test process.
3. Any DB path that is **not** `:memory:` **and** not under `os.tmpdir()`.
4. Any uploads dir that is **not** under `os.tmpdir()` (i.e. not the default
   `process.cwd()/uploads`).

| Item | Detail |
|------|--------|
| Add | `scripts/verify-test-isolation.ts` — **static** guard: walks `packages/server/tests/**/*.ts` and rejects any `createDb(` literal arg that is not exactly `':memory:'` or a `path.join(os.tmpdir(), ...)` / `/tmp/...` pattern. Also rejects any `new AttachmentStore` / uploadsDir literal under `process.cwd()` in tests. |
| Add | `packages/server/tests/setup-d1-guard.ts` — **runtime** guard (vitest setupFile): (a) fails if `process.env.ROOSTER_DB_PATH` is set at test start; (b) monkey-patches `createDb` (via module spy or by exporting a `__assertTestDbPath` hook) so that any non-`:memory:` / non-`os.tmpdir()` path aborts with a clear message; (c) asserts no test ever resolves `uploadsDir` to `process.cwd()/uploads`. |
| Wire | `vitest.config.ts` `setupFiles: ['packages/server/tests/setup-d1-guard.ts']`. |
| Add | `package.json` root script `gate:isolation`: `bun run scripts/verify-test-isolation.ts`. |
| Wire | add `gate:isolation` to `.husky/pre-commit` (cheap static check, no runtime). |

This gives two **independent** layers:
- Layer 1 (physical): test code uses `:memory:` or `os.tmpdir()`.
- Layer 2 (programmatic): both static (`gate:isolation`) and runtime
  (`setup-d1-guard.ts`) verification reject any drift, including via
  `ROOSTER_DB_PATH` env injection.

**Acceptance**: `bun run gate:isolation` exits 0 on a clean tree. Adding a
`createDb('./rooster-cache.db')` or setting `ROOSTER_DB_PATH=/Users/...` in a
test fails the gate before commit, and again at vitest startup.

**Commits**:
1. `feat(scripts): add D1 isolation static guard against resolver defaults`
2. `feat(server/tests): add vitest setup runtime guard for ROOSTER_DB_PATH and createDb args`
3. `chore(husky): wire gate:isolation into pre-commit`

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
cannot join the managed list. Borrow `bat/.github/workflows/ci.yml`'s
contract, but only the jobs that apply to a Hono + better-sqlite3 stack.

Proposed jobs (all parallel, fail-fast at job level):

| Job | What it runs | Maps to |
|-----|--------------|---------|
| `quality` | L1 + G1 + G2 in one job (`bun run lint`, `bun run typecheck`, `bun run test:coverage`, `bun run gate:security`). Either invoke directly or via `nocoo/base-ci/.github/workflows/bun-quality.yml@v2026.1` **if** §9 compatibility check passes. | L1 + G1 + G2 |
| `coverage-gates` | `bun run gate:routes` + `bun run gate:isolation` — static, no runtime | L2 (static) + D1 |
| `l2-e2e` | `bun install --frozen-lockfile` → native rebuild step → `bun run test:e2e` | L2 (runtime) |

**Explicitly not added**: `l3-playwright` (out of scope, no stub, no
`workflow_dispatch`) and `probe` (no Rust component).

Notes:
- Run G2 in CI **and** in pre-push. Pre-push catches the offender; CI catches
  bypassed pushes.
- **Native rebuild caveat — must be verified before this phase ships.** The
  current `scripts/ensure-native.ts` hard-codes
  `packages/server/node_modules/better-sqlite3`. With bun workspaces the
  package can be hoisted to the root `node_modules/`. Before adopting
  `bat`'s pattern of `bun install --frozen-lockfile --ignore-scripts` + per
  trusted-dep rebuild, confirm that the resolver in `ensure-native.ts` finds
  the actual hoist / workspace location. If it doesn't, either (a) fix the
  resolver to traverse `bun pm ls` output, or (b) keep `--ignore-scripts` off
  in CI and let bun's normal install rebuild the native bindings (slower but
  reliable). Pick one; do not assume bat's exact pattern works here.

**Acceptance**: PR to `main` runs all 3 jobs; all green on the post-Phase-4
baseline.

**Commits**:
1. `ci: add .github/workflows/ci.yml (quality, coverage-gates, l2-e2e)`

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
4. `bun run test:e2e` → exit 0 (real `serve()` + real `fetch` / `socket.io-client`; no `app.request`).
5. `bun run gate:routes` → exit 0 in **strict** mode (every route × method has ≥ 1 e2e hit; no baseline file allowed on `main`).
6. `bun run gate:security` → exit 0 (osv-scanner v2 on `bun.lock` + gitleaks `@{u}..HEAD` both clean).
7. `bun run gate:isolation` → exit 0 (no test binds to `'rooster.db'` default, no `ROOSTER_DB_PATH` env at test start, no uploadsDir under `process.cwd()`).
8. `.husky/pre-commit` and `.husky/pre-push` exist and chain the gates above.
9. `.github/workflows/ci.yml` exists; `quality`, `coverage-gates`, `l2-e2e`
   jobs all pass on the latest `main` commit. **No** `l3-playwright` job, **no** `probe` job.

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
   understand Hono's path params (`:id`) and join each sub-router with its
   `app.route()` mount prefix (e.g. `createSessionRoutes` mounted at
   `/api/hermes/sessions`). Bat's script targets static Worker bindings; the
   rooster port needs both the prefix join and `:id` matching.
2. **Socket.IO L2 coverage.** Bat is pure HTTP. Rooster has a `/chat-run`
   namespace. "Covered event" is defined as: for every server-side
   `socket.on('<event>', ...)`, an e2e test calls `client.emit('<event>', ...)`;
   for every server-side `socket.emit('<event>', ...)`, an e2e test installs
   `client.on('<event>', ...)`. Both directions must be enumerated.
3. **`base-ci/.github/workflows/bun-quality.yml@v2026.1` compatibility.**
   `bat` uses CF Workers + workerd. rooster uses Node + better-sqlite3. The
   shared workflow's `pre-command` hook is the only escape valve; if its
   default install assumes wrangler/workerd shape we may need to fork or call
   gates directly. Verify before Phase 5 — fallback is a direct `quality` job.
4. **`/tmp` writes vs CI matrix.** `db.test.ts` writes
   `/tmp/rooster-test-${pid}.db`. Single-runner per job is fine; if a future
   matrix runs the same test twice on the same runner, switch to
   `fs.mkdtempSync(path.join(os.tmpdir(), 'rooster-test-'))`.
5. **`exactOptionalPropertyTypes`.** Per `docs/07`, the project uses it.
   `--max-warnings 0` already enforces this; if new test scaffolds touch `?:`
   typing trickier ways, they may surface fresh G1 violations. Watch during
   implementation.
6. **D1 prod path detection — corrected.** Previous draft (`cb2169d`) named
   `~/.rooster/` and `~/Library/Application Support/rooster/` as banned
   paths. Those are **wrong** — the actual resolver uses
   `ROOSTER_DB_PATH ?? 'rooster.db'` (defaults to `process.cwd()/rooster.db`)
   and uploads default to `process.cwd()/uploads`. Phase 3 has been rewritten
   around the real resolver.

---

## 9. Open Questions for SD-Reviewer-B

1. ~~Is the **L3 deferral** the standing position?~~ **Resolved** by Reviewer-B
   (msg=62aa9265): L3 deferral is standing; CI must not add a stub /
   `workflow_dispatch` placeholder. Plan updated.
2. `osv-scanner v2` on `bun.lock` — confirm the bun version currently in use
   emits a lockfile that osv-scanner v2 can read. Quick check at Phase 1
   start: `bun --version` and a dry `osv-scanner --lockfile=bun.lock`.
3. ~~Commit a failing route-coverage baseline?~~ **Resolved** by Reviewer-B
   (msg=62aa9265): **no baseline file**. Phase 2 ships `gate:routes` in
   report mode first, backfills tests, then flips to strict in the same phase
   sequence. Plan updated.
4. Native `better-sqlite3` rebuild step: the **prerequisite** is verifying
   `scripts/ensure-native.ts`'s hard-coded
   `packages/server/node_modules/better-sqlite3` path actually exists after a
   fresh `bun install` under bun-workspaces hoisting. If not, fix the
   resolver before Phase 5 lands. Captured as Phase 5 caveat.

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

---

## 11. Post-Upgrade Assessment

Recorded after Phases 1–5 shipped to local `main` (HEAD `ae7d686`, 16 commits
ahead of `origin/main` `5fc4ca3`). Pending: push + first green CI run.

### 11.1 Shipped commits (local `main`)

| Phase | Commits |
|-------|---------|
| 0 — doc | `cb2169d`, `f88b861` |
| 1 — G2 | `10f2a2a`, `ca97515` |
| 2 — L2 + gate:routes | `23b0236`, `38218ed`, `557117a`, `2bbe356`, `37978f7` |
| 3 — D1 isolation | `ac7ad28`, `9c43ec0`, `4259da0`, `561d2af` |
| 4 — hooks canonicalization | `f6fed80` |
| 5 — CI | `5d724df`, `ae7d686` |

### 11.2 Final per-dimension state

| Dim | State | Evidence |
|-----|-------|----------|
| L0 | ✅ | `dev` / `build` / `start` scripts unchanged |
| L1 | ✅ | 603 tests, 98.58% stmt / 95.18% br, `vitest.config.ts` thresholds 95/95/95/95 |
| L2 | ✅ | `bun run test:e2e` → real `serve()` + `listen(0)`; `bun run gate:routes` strict 18/18 HTTP + 21/21 socket |
| L3 | ❌ | Out of scope (Tier A target) |
| G1 | ✅ | `bun run lint --max-warnings 0` + `bun run typecheck` |
| G2 | ✅ | `bun run gate:security` (osv-scanner 2.3.8 + gitleaks 8.30.1); CI uses event-driven `GITLEAKS_LOG_OPTS` |
| D1 | ✅ | Static: `bun run gate:isolation` (rejects non-tmp DB paths and uploads). Runtime: `packages/server/tests/setup-d1-guard.ts` enforces `ROOSTER_DB_PATH` allow-list at startup + afterEach |

→ **Tier A** (S minus L3).

### 11.3 Hook + CI matrix (shipped)

```
pre-commit:
  G1 lint
  G1 typecheck
  L1 test:coverage
  D1 gate:isolation

pre-push:
  L2 test:e2e
  L2 gate:routes (strict)
  G2 gate:security

CI (.github/workflows/ci.yml, 3 parallel jobs):
  quality        — G1 + L1 + G2
  coverage-gates — D1 + L2-static (--ignore-scripts)
  l2-e2e         — L2 runtime
```

No `l3-playwright`, no `probe`, no `workflow_dispatch` stub.

### 11.4 Notes / deviations from §4

- **Phase 5 native rebuild**: `scripts/ensure-native.ts` rewritten to be
  hoist-aware via `createRequire(packages/server/package.json).resolve(...)`
  walking up to the package root, instead of the original hardcoded
  `packages/server/node_modules/better-sqlite3` path. quality and l2-e2e CI
  jobs use `bun install --frozen-lockfile` (no `--ignore-scripts`); root
  `trustedDependencies: ["better-sqlite3"]` lets bun rebuild during install,
  and `ensure-native.ts` short-circuits at `bun run test*`. `coverage-gates`
  uses `--ignore-scripts` because the tsx scans don't need the native binding.
- **Phase 5 gitleaks scope**: standalone `bun run gate:security` defaults to
  `@{u}..HEAD`, which is wrong on a fresh CI checkout. CI overrides via
  `GITLEAKS_LOG_OPTS` env var: PR uses `base.sha..head.sha`, push uses
  `before..sha`. Local hooks keep the `@{u}..HEAD` default.
