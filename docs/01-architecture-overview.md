# 01 — Architecture Overview

## 1. Project Goal

Rooster is a web-based management panel for Hermes Agent. It is derived from
[hermes-web-ui](https://github.com/EKKOLearnAI/hermes-web-ui) (v0.6.1,
BSL-1.1 license) with a slimmer scope: **core chat + basic admin**, no
social/collaboration features.

## 2. Scope Classification

### MVP Must-Have (Phase 1)

| Feature | Source |
|---------|--------|
| Chat (streaming, tool traces, reasoning) | run-chat service, Socket.IO |
| Session list / history | sessions routes, session-store |
| Profile selection (switch active profile) | profiles routes |
| Model selection (switch model for chat) | models routes |
| Agent status (bridge connected / disconnected) | health route, bridge manager |

### Phase 2 Candidate

| Feature | Source |
|---------|--------|
| Reasoning/thinking block display | run-chat events |
| Approval flow (tool permission dialogs) | run-chat approval events |
| File attachment in chat | upload route |
| Session search | sessions search route |
| Session export | sessions export route |
| Dark mode | Primer CSS built-in |
| Context compression indicator | compression events |

### Phase 3 Candidate (Admin)

| Feature | Source |
|---------|--------|
| Profile management (full CRUD) | profiles routes |
| Skills management | skills routes |
| Plugins | plugins routes |
| Memory browser | memory routes |
| Models & providers config | models/providers routes |
| File browser | files routes |
| Terminal | terminal WebSocket |
| Logs viewer | logs routes |
| Jobs / cron history | jobs routes |
| Runtime config / settings | config routes |
| Self-update | update routes |

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
│            Koa + Socket.IO + node:sqlite             │
│            (inherited from hermes-web-ui)            │
└──────────────┬────────────────────┬──────────────────┘
               │ IPC socket         │ HTTP proxy (SSE)
               ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                   Hermes Agent                        │
│         (Python, managed externally)                 │
└─────────────────────────────────────────────────────┘
```

## 4. Technology Stack

| Layer | hermes-web-ui (source) | Rooster (target) |
|-------|------------------------|-------------------|
| Frontend framework | Vue 3 + Naive UI | **Preact** (3KB, JSX, hooks) |
| Frontend bundler | Vite | Vite (same) |
| Frontend styling | Sass + Naive UI components | **Primer CSS** (GitHub design system) |
| Frontend state | Pinia stores | Preact signals or simple module state |
| Server framework | Koa | Koa (inherited verbatim) |
| Server DB | node:sqlite | node:sqlite (inherited verbatim) |
| Real-time | Socket.IO | Socket.IO (inherited verbatim) |
| Agent protocol | AgentBridge (IPC) + Gateway (SSE) | Same (inherited verbatim) |
| Auth | JWT (custom HS256) | **None** (removed, trusted network) |
| Package structure | Single-package monolith | **npm workspaces** |

## 5. Monorepo Structure

```
rooster/
├── packages/
│   ├── server/          # Koa server — inherited & cleaned
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── hermes/     # Kept routes (same paths)
│   │   │   │   └── index.ts    # Route registration
│   │   │   ├── services/
│   │   │   │   └── hermes/     # run-chat, agent-bridge, gateway
│   │   │   ├── db/
│   │   │   │   └── hermes/     # session-store, schemas, etc.
│   │   │   ├── controllers/
│   │   │   │   └── hermes/     # Request handlers
│   │   │   └── lib/            # Shared utils
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── client/          # Vite SPA — complete rewrite
│       ├── src/
│       │   ├── main.tsx
│       │   ├── pages/
│       │   ├── components/
│       │   ├── api/
│       │   ├── ws/
│       │   └── state/
│       ├── index.html
│       ├── package.json
│       └── tsconfig.json
├── docs/                # Design documents
├── NOTICE               # BSL-1.1 attribution + derivation notes
├── LICENSE              # BSL-1.1 (hermes-web-ui, covers inherited server code)
├── package.json         # Workspace root
└── vitest.config.ts     # Test config
```

## 6. Key Design Decisions

1. **Preact over vanilla TS** — Chat streaming with tool traces, reasoning
   blocks, and approval dialogs creates complex DOM lifecycle. Preact gives
   us JSX, hooks, and efficient diffing at 3KB. Primer CSS handles all
   styling; Preact handles rendering. (See doc 03 §1 for rationale.)

2. **No auth** — Single-user admin panel on trusted network. Default bind to
   `127.0.0.1`. Remote access via reverse proxy with auth is the operator's
   responsibility.

3. **Keep API paths unchanged** — All `/api/hermes/*` paths stay the same.
   Only auth middleware is removed. This preserves any existing integrations.

4. **Agent bridge untouched** — The IPC/TCP communication with the Python
   bridge is inherited verbatim to maintain Hermes Agent compatibility.

5. **npm workspaces** — Unlike the source monolith, Rooster uses proper
   workspaces for clean dependency boundaries, independent testing, and
   parallel builds.

6. **BSL-1.1 compliance** — The root LICENSE is BSL-1.1 (inherited from
   hermes-web-ui, which dominates the server codebase). New files authored
   for Rooster (primarily the client rewrite) carry per-file SPDX headers
   (`SPDX-License-Identifier: MIT`). NOTICE documents the derivation and
   the dual-license boundary.

## 7. Reference

- Source: `~/workspace/reference/hermes-web-ui` (v0.6.1, commit `0eab6a1`)
- Target: `~/workspace/personal/rooster`
- Upstream: https://github.com/EKKOLearnAI/hermes-web-ui
