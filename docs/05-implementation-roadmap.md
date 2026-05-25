# 05 — Implementation Roadmap

## Phased Delivery

Each phase is a shippable increment. Phase 1 is the MVP — a working chat
that connects to Hermes Agent.

---

## Phase 1 — Chat MVP

**Goal**: Send a message, see streaming response, view history.

### Server Tasks
1. Bootstrap monorepo (`package.json` workspace root)
2. Copy & strip server package (remove auth, stripped routes/services)
3. Verify AgentBridge + ChatRunService work with real Hermes Agent
4. Minimal SQLite schema (sessions + messages)
5. Integration test: mock bridge → Socket.IO events

### Client Tasks
1. Vite + TypeScript + Primer CSS scaffold
2. Router (history API, ~50 LOC)
3. Layout shell (sidebar + main content)
4. Chat page: message list, input, streaming display
5. Socket.IO client: connect, send, handle events
6. Markdown rendering (markdown-it + highlight.js)
7. Session list in sidebar (fetch from REST)

### Deliverable
- Start server, open browser, chat with Hermes Agent
- Messages persist across page reloads
- Session history visible in sidebar

---

## Phase 2 — Chat Polish

**Goal**: Production-quality chat experience.

### Tasks
1. Reasoning/thinking block (collapsible)
2. Tool trace display (collapsible, shows input/output)
3. Code block copy button
4. Auto-scroll with "jump to bottom" button
5. File attachment (upload + display in messages)
6. Abort button (stop generation)
7. Approval flow UI (tool approval dialog)
8. Context compression indicator
9. Dark mode toggle
10. Mobile responsive layout

---

## Phase 3 — Admin Features

**Goal**: Full management panel for Hermes Agent configuration.

### Tasks
1. Profile management page (CRUD, config editor)
2. Skills management page (list, create, edit SKILL.md)
3. Plugins page (install, remove)
4. Memory browser (list, delete entries)
5. Models & providers page (list, configure)
6. Runtime config / settings page
7. File browser page
8. Terminal page (xterm.js)
9. Log viewer page
10. Jobs page (list, view detail)

---

## Phase 4 — Hardening

**Goal**: Robustness for daily use.

### Tasks
1. Error boundary / global error handling
2. Reconnection logic (Socket.IO auto-reconnect + UI indicator)
3. Offline indicator
4. Session search (full-text)
5. Batch session delete
6. Keyboard shortcuts (new session, abort, focus input)
7. Self-update mechanism

---

## Estimated Effort

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Chat MVP | 2–3 days |
| Phase 2 | Chat polish | 2–3 days |
| Phase 3 | Admin features | 3–5 days |
| Phase 4 | Hardening | 1–2 days |

Total: ~8–13 days to full feature parity (minus stripped features).
