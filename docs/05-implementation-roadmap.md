# 05 — Implementation Roadmap

## Phased Delivery

Each phase is a shippable increment. Phase 1 is tightly scoped to a working
chat that connects to Hermes Agent.

## Constraints (apply to all phases)

| Constraint | Rule |
|-----------|------|
| Package manager | **bun** (no npm/yarn/pnpm lockfiles; commit `bun.lock`) |
| Dependencies | Latest stable via `bun add <pkg>@latest` at init |
| Pre-commit chain | `bun run lint` → `bun run typecheck` → `bun run test:coverage` |
| Coverage gate | 95%+ or commit blocked. Server: no exclusions. Client: only `pages/**` and `components/**/*.view.tsx` excluded |
| Commits | Atomic, to local `main`, never auto-push |
| Implementation | Clean-room from protocol spec; no hermes-web-ui code copied |

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

**Goal**: Full management panel. Each is independent and can ship separately.
Each feature requires its own design/review cycle before implementation.

| Feature | Prerequisite |
|---------|-------------|
| Profile management (CRUD, config editor) | Phase 1 + design review |
| Skills management (list, create, edit) | Phase 1 + design review |
| Plugins (install, remove) | Phase 1 + design review |
| Memory browser (list, delete) | Phase 1 + design review |
| Models & providers config | Phase 1 + design review |
| File browser | Phase 1 + separate security review |
| Terminal (xterm.js) | Phase 1 + separate security review |
| Log viewer | Phase 1 + design review |
| Jobs / cron history | Phase 1 + design review |
| Runtime config / settings | Phase 1 + design review |
| Self-update | Phase 1 + separate security review |

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
| Phase 3 | Admin features (11 pages) | 4–6 days |
| Phase 4 | Hardening | 1–2 days |

**Phase 1 is the only blocking phase.** Phases 2–4 are additive and can be
prioritized based on daily use feedback.
