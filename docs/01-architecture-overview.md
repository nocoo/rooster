# 01 — Architecture Overview

## 1. Project Goal

Rooster is a web-based management panel for Hermes Agent. It is a **clean-room
reimplementation** inspired by hermes-web-ui's protocol and behavior, with a
slimmer scope: **core chat + basic admin**, no social/collaboration features.

No source code is copied from hermes-web-ui. The reference repository
(`~/workspace/reference/hermes-web-ui`) is used solely to understand the
IPC/Socket.IO protocol and API contract.

## 2. Scope Classification

### MVP Must-Have (Phase 1)

| Feature | Protocol Reference |
|---------|-------------------|
| Chat (streaming, tool traces, reasoning) | Socket.IO `/chat-run` namespace events |
| Session list / history | REST `/api/hermes/sessions` |
| Profile selection (switch active profile) | REST `/api/hermes/profiles` |
| Model selection (switch model for chat) | REST `/api/hermes/models` |
| Agent status (bridge connected / disconnected) | `/health` + bridge ping |

### Phase 2 Candidate

| Feature | Protocol Reference |
|---------|-------------------|
| Reasoning/thinking block display | `reasoning.delta` / `reasoning.available` events |
| Approval flow (tool permission dialogs) | `approval.requested` / `approval.resolved` events |
| File attachment in chat | upload endpoint |
| Session search | sessions search endpoint |
| Session export | sessions export endpoint |
| Dark mode | Primer CSS built-in |
| Context compression indicator | `compression.*` events |

### Phase 3 Candidate (Admin)

| Feature | Protocol Reference |
|---------|-------------------|
| Profile management (full CRUD) | profiles REST API |
| Skills management | skills REST API |
| Plugins | plugins REST API |
| Memory browser | memory REST API |
| Models & providers config | models/providers REST API |
| File browser | files REST API |
| Logs viewer | logs REST API |
| Jobs / cron history | jobs REST API |
| Runtime config / settings | config REST API |

### Explicitly Out of Scope

| Feature | Reason |
|---------|--------|
| Login / user management / JWT auth | Single-user panel; network-level access only |
| Kanban board | Collaboration feature |
| Group chat | Collaboration feature |
| API relay / proxy routing | External service |
| Monitoring: skill usage, performance, token usage views | Not needed for MVP |
| Voice / TTS | Not needed |
| Video animation / ink-style effects | Cosmetic |
| WeChat / channel integrations | Platform-specific |
| Docker / Playwright | Not needed for dev |

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                      │
│            Vite + Preact + Primer CSS                │
└──────────────┬────────────────────┬──────────────────┘
               │ REST (fetch)       │ Socket.IO (/chat-run)
               ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                  Rooster Server                       │
│        Hono + Socket.IO + better-sqlite3             │
│         (reimplemented from protocol spec)           │
└──────────────────────────┬──────────────────────────┘
                           │ IPC socket (JSON + newline)
                           ▼
┌─────────────────────────────────────────────────────┐
│                   Hermes Agent                        │
│         (Python, managed externally)                 │
└─────────────────────────────────────────────────────┘
```

## 4. Technology Stack

| Layer | hermes-web-ui (reference) | Rooster (target) |
|-------|--------------------------|-------------------|
| Frontend framework | Vue 3 + Naive UI | **Preact** (3KB, JSX, hooks) |
| Frontend bundler | Vite | Vite (same concept, latest stable) |
| Frontend styling | Sass + Naive UI components | **Primer CSS** (GitHub design system) |
| Frontend state | Pinia stores | **@preact/signals** |
| Server framework | Koa | **Hono** (lightweight, Web Standard APIs) |
| Server DB | node:sqlite | **better-sqlite3** (synchronous, well-tested) |
| Real-time | Socket.IO | **Socket.IO** (protocol-compatible) |
| Agent protocol | AgentBridge (IPC) + Gateway (SSE) | **AgentBridge IPC only** (Phase 1); Gateway SSE planned for future |
| Auth | JWT (custom HS256) | **None** (trusted network) |
| Package manager | npm | **bun** |
| Package structure | Single-package monolith | **bun workspaces** |
| Testing | — | **vitest** (95%+ coverage) |
| Linting | — | **eslint** (strict, zero warnings) |

## 5. Monorepo Structure

```
rooster/
├── packages/
│   ├── server/          # Hono server — reimplemented from protocol spec
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point (bind + listen)
│   │   │   ├── app.ts           # Hono app assembly (route registration)
│   │   │   ├── server.ts        # HTTP + Socket.IO server creation
│   │   │   ├── routes/
│   │   │   │   ├── health.ts    # /health (bridge ping)
│   │   │   │   ├── sessions.ts  # /api/hermes/sessions (CRUD + conversations)
│   │   │   │   └── bridge.ts    # /api/hermes/{profiles,models,providers}
│   │   │   ├── services/
│   │   │   │   └── hermes/
│   │   │   │       ├── agent-bridge.ts   # IPC/TCP client
│   │   │   │       ├── db.ts             # SQLite init + schema
│   │   │   │       ├── session-store.ts  # Session CRUD
│   │   │   │       ├── message-store.ts  # Message persistence
│   │   │   │       └── chat-run/         # Socket.IO chat orchestration
│   │   │   └── lib/
│   │   │       └── logger.ts    # pino logger
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── client/          # Vite SPA
│       ├── src/
│       │   ├── main.tsx
│       │   ├── pages/
│       │   │   └── App.tsx
│       │   ├── components/
│       │   │   ├── ChatInput.tsx
│       │   │   ├── MessageHistory.tsx
│       │   │   ├── SessionList.tsx
│       │   │   ├── StreamingMessage.tsx
│       │   │   ├── ToolTrace.tsx
│       │   │   └── HeaderSettings.tsx
│       │   ├── api/
│       │   │   ├── client.ts
│       │   │   ├── sessions.ts
│       │   │   └── settings.ts
│       │   ├── ws/
│       │   │   └── chat.ts
│       │   └── state/
│       │       ├── sessions.ts
│       │       ├── chat.ts
│       │       └── settings.ts
│       ├── index.html
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── docs/                # Design documents
├── scripts/             # Build helpers (ensure-native.ts)
├── package.json         # Workspace root (bun workspaces)
├── bunfig.toml          # Bun configuration
├── vitest.config.ts     # Test config (coverage thresholds)
└── eslint.config.ts     # Flat config, strict mode
```

## 6. Key Design Decisions

1. **Clean-room reimplementation** — No hermes-web-ui source code is copied.
   We implement against the documented protocol (IPC actions, Socket.IO
   events, REST API paths). This eliminates any BSL-1.1 license concern.

2. **Preact over vanilla TS** — Chat streaming with tool traces, reasoning
   blocks, and approval dialogs creates complex DOM lifecycle. Preact gives
   us JSX, hooks, and efficient diffing at 3KB. Primer CSS handles all
   styling; Preact handles rendering. (See doc 03 §1 for rationale.)

3. **No auth** — Single-user admin panel on trusted network. Default bind to
   `127.0.0.1`. Remote access via reverse proxy with auth is the operator's
   responsibility.

4. **Keep API paths unchanged** — All `/api/hermes/*` paths match
   hermes-web-ui's contract. This ensures Hermes Agent compatibility.

5. **Agent bridge protocol-compatible** — The IPC/TCP communication with the
   Python bridge is reimplemented to be wire-compatible with Hermes Agent.

6. **bun workspaces** — Fast installs, native TypeScript execution, built-in
   test runner integration. Workspaces enable clean dependency boundaries.

7. **Quality gates (pre-commit)** — UT coverage 95%+ (client view layer
   excluded), ESLint strict mode with zero warnings/errors. Enforced via
   pre-commit hooks.

## 7. Reference

- Protocol reference: `~/workspace/reference/hermes-web-ui` (v0.6.1, commit `0eab6a1`)
- Target: `~/workspace/personal/rooster`
- Upstream docs: https://github.com/EKKOLearnAI/hermes-web-ui
