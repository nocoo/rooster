# 05 — Implementation Roadmap

## Admin Navigation Design

Phase 3 admin work must live in a dedicated admin surface, separate from the
chat/session workspace.

### Entry Point

- Add a clear "Admin" entry in the app header or primary chrome.
- The entry navigates to `/admin`.
- The chat session list remains chat-only; admin navigation must not be mixed
  into the session sidebar.

### Admin Page Shell

```
┌─────────────────────────────────────────────────────────┐
│ App Header: rooster                     [Admin] [Status]│
├────────────────────┬────────────────────────────────────┤
│ Admin Nav          │  Admin Content                      │
│                    │                                    │
│  ◉ Overview        │  Page title                         │
│  ⚙ Profiles        │  Filters / actions                  │
│  ✦ Skills          │  Table / editor / detail panel      │
│  ◇ Plugins         │                                    │
│  ◌ Memory          │                                    │
│  ◍ Models          │                                    │
│  ▣ Files           │                                    │
│  ≡ Logs            │                                    │
│  ◷ Jobs            │                                    │
│  ⛭ Settings        │                                    │
└────────────────────┴────────────────────────────────────┘
```

### Navigation Rules

- Admin uses its own sidebar with icon + text items.
- The sidebar is persistent across all admin pages.
- Use stable routes under `/admin/*`; do not overload chat routes.
- Each admin item should be independently shippable and independently tested.
- Keep cards sparse. Admin pages should feel like operational tools: dense,
  scannable, and predictable.
- Dangerous operations require confirmation and clear result feedback.

## Phased Delivery

Each phase is a shippable increment. Phase 1 is tightly scoped to a working
chat that connects to Hermes Agent.

## Constraints (apply to all phases)

| Constraint | Rule |
|-----------|------|
| Package manager | **bun** (no npm/yarn/pnpm lockfiles; commit `bun.lock`) |
| Dependencies | Latest stable via `bun add <pkg>@latest` at init |
| Pre-commit chain | `bun run lint` → `bun run typecheck` → `bun run test:coverage` → `bun run gate:isolation` |
| Coverage gate | 95%+ or commit blocked. Server: no exclusions. Client: only `pages/**` and `components/**/*.view.tsx` excluded |
| Commits | Atomic, to local `main`, never auto-push |
| Implementation | Clean-room from protocol spec; no hermes-web-ui code copied |
| Verification | Every task must state expected behavior, targeted tests, full local gate, and manual proof when UI behavior is involved |

---

## Phase 1 — Chat MVP

**Goal**: Send a message, see streaming response, switch sessions.

**Acceptance criteria**:
- Start server → browser opens → chat with Hermes Agent works
- Messages stream in real-time (no polling delay visible to user)
- Tool calls show as collapsible traces
- Sessions persist across page reloads
- Can create new session, switch between sessions
- Can select profile and model before sending

### Infrastructure Tasks

1. Create bun workspace root (`package.json`, `bunfig.toml`)
2. Initialize packages with `bun add <pkg>@latest` / `bun add -d <pkg>@latest`;
   commit `bun.lock`; delete any npm/yarn/pnpm lockfiles if generated
3. Configure vitest with v8 coverage provider + 95% threshold (fail on miss)
4. Configure ESLint flat config (strict, `--max-warnings 0`)
5. Configure husky + lint-staged:
   ```
   pre-commit: bun run lint → bun run typecheck → bun run test:coverage
   ```
6. Configure TypeScript (strict mode, path aliases)

### Server Tasks (Hono)

1. Create `packages/server/package.json` (hono, socket.io, better-sqlite3, pino)
2. Implement Hono app skeleton with error handling middleware
3. Implement Agent Bridge client:
   - IPC/TCP connection (JSON + newline protocol)
   - Serialization lock
   - `chat`, `get_output`, `ping` actions (minimum for chat)
   - Timeout + reconnection logic
4. Implement Session store (better-sqlite3):
   - `sessions` + `messages` tables
   - CRUD operations: create, get, list, delete
5. Implement Socket.IO `/chat-run` namespace:
   - `run` event handler → bridge chat + poll loop → emit events
   - `abort` event handler → bridge interrupt
   - `resume` event handler → session state recovery
6. Implement Phase 1 REST routes:

   | Route | Verb | Purpose |
   |-------|------|---------|
   | `/health` | GET | Server + bridge status |
   | `/api/hermes/sessions` | GET | List sessions |
   | `/api/hermes/sessions/:id` | GET | Get session detail |
   | `/api/hermes/sessions/:id` | DELETE | Delete session |
   | `/api/hermes/sessions/:id/rename` | POST | Rename session |
   | `/api/hermes/sessions/conversations` | GET | List conversations |
   | `/api/hermes/sessions/conversations/:id/messages` | GET | Get messages |
   | `/api/hermes/sessions/conversations/:id/messages/paginated` | GET | Paginated messages |
   | `/api/hermes/sessions/hermes` | GET | Hermes sessions |
   | `/api/hermes/sessions/hermes/:id` | GET | Single hermes session |
   | `/api/hermes/profiles` | GET | List profiles |
   | `/api/hermes/models` | GET | List available models |
   | `/api/hermes/providers` | GET | List providers |

7. Set `BIND_HOST` default to `127.0.0.1`
8. Verify server starts and responds to `/health`
9. Write tests: mock bridge → Socket.IO `run.started` + `message.delta` + `run.completed`

### Client Tasks

1. Create `packages/client/package.json` (vite, preact, @primer/css, socket.io-client)
2. Vite config with Preact JSX transform
3. `index.html` with Primer CSS link + dark mode inline script
4. Layout shell: header + sidebar + main
5. Session list component (fetch from `/api/hermes/sessions`)
6. Chat page: message list + input + send
7. Socket.IO client: connect, emit `run` (with `session_id`), handle streaming events
8. `MessageBubble` with markdown rendering (markdown-it + highlight.js)
9. `ToolTrace` (collapsible)
10. Profile/model selector in header
11. New session button

### Deliverable

Working chat with Hermes Agent. Start: `bun run dev`. Open browser. Chat.

---

## Phase 2 — Chat Polish

**Goal**: Production-quality chat experience.

| Task | Priority |
|------|----------|
| Reasoning/thinking block (collapsible) | High |
| Abort button (stop generation mid-stream) | High |
| Approval flow UI (tool permission dialog) | High |
| Auto-scroll with "jump to bottom" button | Medium |
| Code block copy button | Medium |
| File attachment (upload) | Medium |
| Context compression indicator | Low |
| Session search | Low |
| Dark mode toggle | Low |
| Mobile responsive | Low |
| Keyboard shortcuts (Ctrl+Enter send, Esc abort) | Low |

---

## Phase 3 — Admin Features

**Goal**: Full management panel. Phase 3 contains 10 tasks: 1 shared admin
shell/navigation task plus 9 independent admin feature pages.

Each task must be implemented as an atomic local commit. Do not start the next
task until the previous task has passing tests and reviewer approval.

### Phase 3 Task List

| # | Task | Expected result | Minimum tests | Verification |
|---|------|-----------------|---------------|--------------|
| 1 | Admin shell + sidebar navigation | `/admin` opens a dedicated admin layout with icon+text sidebar, obvious entry from app chrome, and no mixing with the chat session list. Default page shows an overview/placeholder and links to all admin sections. | Router/layout test for `/admin`; header entry test; sidebar nav item test; mobile sidebar behavior test if implemented. | Targeted client tests + `bash .husky/pre-commit`; screenshot or manual notes proving chat sidebar and admin sidebar are distinct. |
| 2 | Profile management | Admin page lists profiles, shows current/default profile data, and supports create/edit/delete or a clearly staged read-only first version if write protocol is not ready. | API/client state tests; component tests for list, edit validation, delete confirmation. | Targeted tests + pre-commit; manual create/edit/delete or read-only proof against mock fixtures. |
| 3 | Skills management | Admin page lists skills with name, description, source/path, and status; create/edit flows are included only if the protocol is stable. | Component tests for list/detail; validation tests for create/edit form if shipped. | Targeted tests + pre-commit; manual proof that a skill can be inspected without leaving chat. |
| 4 | Plugins management | Admin page lists installed plugins, manifest metadata, status, and safe install/remove controls when protocol support exists. | Component tests for plugin table and confirmation flows; API tests for install/remove endpoints if added. | Targeted tests + pre-commit; manual proof of status display and safe failure handling. |
| 5 | Memory browser | Admin page lists memory entries, supports search/filter, detail preview, and delete with confirmation. | API/state tests for list/search/delete; component tests for empty/loading/error/detail/delete states. | Targeted tests + pre-commit; manual proof that a bad memory can be found and removed. |
| 6 | Models & providers config | Admin page shows provider/model configuration, enabled status, default selections, and safe editing for non-secret fields. | Validation tests; component tests for provider/model table and edit form; secret masking tests. | Targeted tests + pre-commit; manual proof that secrets are not exposed and config changes are reflected in selectors. |
| 7 | File browser | Admin page browses an allowed root, previews/downloads safe files, and blocks path traversal. | Server tests for root boundary/path traversal; component tests for tree/list/detail states. | Targeted server+client tests + pre-commit; separate security review before enabling write/delete actions. |
| 8 | Log viewer | Admin page displays recent server/bridge/agent logs with level filter, search, copy, and truncation. | API tests for log retrieval/filtering; component tests for level/search/empty/error states. | Targeted tests + pre-commit; manual proof from a controlled log fixture. |
| 9 | Jobs / cron history | Admin page shows job/cron history with status, timing, output/error, and optional retry if protocol supports it. | API/state tests for list/detail; component tests for status filters and retry confirmation if shipped. | Targeted tests + pre-commit; manual proof that failed jobs are visible with useful details. |
| 10 | Runtime config / settings | Admin page shows Rooster runtime config and editable safe settings; read-only unsafe fields are clearly labeled. | Validation tests; component tests for read-only vs editable fields; save success/failure feedback tests. | Targeted tests + pre-commit; manual proof that changed settings persist or that read-only settings cannot be edited. |

### Task Rules

- One task = one atomic local commit unless reviewer explicitly asks for a
  split.
- Every task must include tests that prove expected behavior and failure
  states.
- Every task must run targeted tests plus `bash .husky/pre-commit` before
  review.
- If a task adds/changes HTTP routes, update `scripts/check-route-coverage.ts`
  inputs and add L2 e2e coverage so `bun run gate:routes` remains strict green.
- If a task touches filesystem access, credentials, or destructive operations,
  do a security design review before implementation.
- Push only after reviewer approval.

---

## Phase 4 — Hardening

| Task |
|------|
| Error boundary / global error display |
| Socket.IO reconnection UI indicator |
| Offline detection |
| Session batch delete |
| Session export (JSON/Markdown) |

---

## Effort Estimates

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Chat MVP (server reimpl + client) | 4–5 days |
| Phase 2 | Chat polish (11 items) | 2–3 days |
| Phase 3 | Admin shell + 9 admin feature pages | 4–6 days |
| Phase 4 | Hardening | 1–2 days |

**Phase 1 is the only blocking phase.** Phases 2–4 are additive and can be
prioritized based on daily use feedback.
