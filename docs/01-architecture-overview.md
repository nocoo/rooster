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
| Terminal | terminal WebSocket |
| Logs viewer | logs REST API |
| Jobs / cron history | jobs REST API |
| Runtime config / settings | config REST API |
| Self-update | update REST API |

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
│         Koa + Socket.IO + better-sqlite3             │
│         (reimplemented from protocol spec)           │
└──────────────┬────────────────────┬──────────────────┘
               │ IPC socket         │ HTTP proxy (SSE)
               ▼                    ▼
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
| Server framework | Koa | **Koa** (reimplemented, same framework choice) |
| Server DB | node:sqlite | **better-sqlite3** (synchronous, well-tested) |
| Real-time | Socket.IO | **Socket.IO** (protocol-compatible) |
| Agent protocol | AgentBridge (IPC) + Gateway (SSE) | Reimplemented to match protocol spec |
| Auth | JWT (custom HS256) | **None** (trusted network) |
| Package manager | npm | **bun** |
| Package structure | Single-package monolith | **bun workspaces** |
| Testing | — | **vitest** (95%+ coverage) |
| Linting | — | **eslint** (strict, zero warnings) |

## 5. Monorepo Structure

```
rooster/
├── packages/
│   ├── server/          # Koa server — reimplemented from protocol spec
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── hermes/     # Protocol-compatible routes
│   │   │   │   └── index.ts    # Route registration
│   │   │   ├── services/
│   │   │   │   └── hermes/     # chat-run, agent-bridge, gateway
│   │   │   ├── db/
│   │   │   │   └── hermes/     # session-store, schemas
│   │   │   └── lib/            # Shared utils
│   │   ├── tests/              # 95%+ coverage target
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── client/          # Vite SPA — complete implementation
│       ├── src/
│       │   ├── main.tsx
│       │   ├── pages/
│       │   ├── components/
│       │   ├── api/
│       │   ├── ws/
│       │   └── state/
│       ├── index.html
│       ├── tests/              # 95%+ (views excluded)
│       ├── package.json
│       └── tsconfig.json
├── docs/                # Design documents
├── LICENSE              # MIT
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
