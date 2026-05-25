# 05 — Implementation Roadmap

## Phased Delivery

Each phase is a shippable increment. Phase 1 is tightly scoped to a working
chat that connects to Hermes Agent.

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

### Server Tasks

1. Create npm workspace root (`package.json`, `vitest.config.ts`)
2. Create `packages/server/package.json` with extracted dependencies
3. Copy core server source from reference:
   - `services/hermes/run-chat/` (all 16 files)
   - `services/hermes/agent-bridge/` (all 5 files)
   - `services/hermes/gateway-manager.ts`
   - `db/` (index, hermes/init, schemas, session-store, sessions-db,
     conversations-db, message-content, usage-store, compression-snapshot)
   - `routes/health.ts`
   - `routes/hermes/sessions.ts`, `chat-run.ts`, `profiles.ts`, `models.ts`,
     `providers.ts`
   - `controllers/hermes/sessions.ts`, `profiles.ts`, `models.ts`
   - Supporting: logger, config, lib utils
4. Remove auth middleware from route chain
5. Remove user/group-chat/kanban/tts/media tables from `initAllHermesTables()`
6. Set `BIND_HOST` default to `127.0.0.1`
7. Register only Phase 1 routes in `routes/index.ts`:

   | Registered (Phase 1) | Copied but NOT registered | Removed (never copied) |
   |---------------------|--------------------------|------------------------|
   | `healthRoutes` | `skillRoutes` | `authRoutes` |
   | `sessionRoutes` | `pluginRoutes` | `kanbanRoutes` |
   | `profileRoutes` | `memoryRoutes` | `groupChatRoutes` |
   | `modelRoutes` | `configRoutes` | `ttsRoutes` |
   | `providerRoutes` | `fileRoutes` | `mediaRoutes` |
   | `chatRunSocket` (Socket.IO) | `downloadRoutes` | `performanceMonitorRoutes` |
   | `uploadRoutes` | `logRoutes` | `weixinRoutes` |
   | | `jobRoutes` | `proxyRoutes` |
   | | `cronHistoryRoutes` | `codexAuthRoutes` |
   | | `terminalRoutes` | `nousAuthRoutes` |
   | | `updateRoutes` | `copilotAuthRoutes` |
   | | | `xaiAuthRoutes` |

   Phase 3 enables the "copied but not registered" routes one by one.

8. Verify server starts and responds to `/health`
9. Write test: mock bridge → Socket.IO `run.started` + `message.delta` + `run.completed`

### Client Tasks

1. Create `packages/client/package.json` (Vite, Preact, Primer CSS, socket.io-client)
2. Vite config with Preact JSX transform
3. `index.html` with Primer CSS link + dark mode inline script
4. Layout shell: header + sidebar + main
5. Session list component (fetch from `/api/hermes/sessions`)
6. Chat page: message list + input + send
7. Socket.IO client: connect, emit `run`, handle streaming events
8. `MessageBubble` with markdown rendering (markdown-it + highlight.js)
9. `ToolTrace` (collapsible)
10. Profile/model selector in header
11. New session button

### Deliverable

Working chat with Hermes Agent. Start: `npm run dev`. Open browser. Chat.

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

| Feature | Depends On |
|---------|-----------|
| Profile management (CRUD, config editor) | Phase 1 |
| Skills management (list, create, edit) | Phase 1 |
| Plugins (install, remove) | Phase 1 |
| Memory browser (list, delete) | Phase 1 |
| Models & providers config | Phase 1 |
| File browser | Phase 1 |
| Terminal (xterm.js) | Phase 1 |
| Log viewer | Phase 1 |
| Jobs / cron history | Phase 1 |
| Runtime config / settings | Phase 1 |
| Self-update | Phase 1 |

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
| Phase 1 | Chat MVP (server strip + client rewrite) | 3–4 days |
| Phase 2 | Chat polish (10 items) | 2–3 days |
| Phase 3 | Admin features (11 pages) | 4–6 days |
| Phase 4 | Hardening | 1–2 days |

**Phase 1 is the only blocking phase.** Phases 2–4 are additive and can be
prioritized based on daily use feedback.
