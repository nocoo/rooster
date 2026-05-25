# 01 — Architecture Overview

## 1. Project Goal

Rooster is a web-based management panel for Hermes Agent. It is derived from
[hermes-web-ui](https://github.com/EKKOLearnAI/hermes-web-ui) (v0.6.1) with
a slimmer scope: **core chat + basic admin**, no social/collaboration features.

## 2. Scope — Keep vs Strip

### Kept (core)

| Feature | Source |
|---------|--------|
| Chat (streaming, tool traces, reasoning display) | client chat views, server chat-run service |
| Sessions (CRUD, search, history) | server sessions routes |
| Profiles (manage agent configurations) | server profiles routes |
| Skills management | server skills routes |
| Plugins | server plugins routes |
| Memory (agent memory browser) | server memory routes |
| Models & Providers | server models/providers routes |
| File browser / upload | server files routes |
| Terminal (xterm.js) | server terminal WebSocket |
| Logs viewer | server logs routes |
| Jobs / Cron history | server jobs routes |
| Settings / Config | server config routes |
| Self-update | server update routes |

### Stripped

| Feature | Reason |
|---------|--------|
| Login / user management / JWT auth | Single-user panel; network-level access control only |
| Kanban board | Collaboration feature, out of scope |
| Group chat | Collaboration feature, out of scope |
| API relay / proxy routing | External service feature |
| Monitoring: skill usage, performance, token usage views | Low priority, can add later |
| Voice / TTS | Not needed for MVP |
| Video animation / ink-style effects | Cosmetic, stripped |
| WeChat / channel integrations | Platform-specific |
| Docker / Playwright | Not needed for MVP dev |

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                      │
│          Vite + Vanilla TS + Primer CSS              │
└──────────────┬────────────────────┬──────────────────┘
               │ REST (fetch)       │ Socket.IO (/chat-run)
               ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                  Rooster Server                       │
│            Koa + Socket.IO + node:sqlite             │
└──────────────┬────────────────────┬──────────────────┘
               │ IPC socket         │ HTTP proxy (SSE)
               ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                   Hermes Agent                        │
│         (Python, managed externally)                 │
└─────────────────────────────────────────────────────┘
```

## 4. Technology Stack

| Layer | hermes-web-ui (current) | Rooster (target) |
|-------|------------------------|-------------------|
| Frontend framework | Vue 3 + Naive UI | Vanilla TypeScript (no framework) |
| Frontend bundler | Vite | Vite |
| Frontend styling | Sass + Naive UI | Primer CSS (GitHub's design system) |
| Frontend state | Pinia stores | Simple module-level state + custom events |
| Server framework | Koa | Koa (inherited) |
| Server DB | node:sqlite | node:sqlite (inherited) |
| Real-time | Socket.IO | Socket.IO (inherited) |
| Agent protocol | AgentBridge (IPC/TCP) + Gateway (HTTP/SSE) | Same (inherited) |
| Auth | JWT (custom) | None (single-user, trusted network) |

## 5. Monorepo Structure (Target)

```
rooster/
├── packages/
│   ├── server/          # Koa server — inherited & cleaned
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/          # Cleaned API routes
│   │   │   ├── services/        # Business logic
│   │   │   │   └── hermes/      # Agent bridge + gateway
│   │   │   ├── db/              # SQLite schema + queries
│   │   │   └── lib/             # Shared utils
│   │   ├── tests/               # Unit + integration tests
│   │   └── package.json
│   └── client/          # Vite SPA — complete rewrite
│       ├── src/
│       │   ├── main.ts
│       │   ├── pages/           # Page modules
│       │   ├── components/      # Shared UI components
│       │   ├── api/             # REST client
│       │   ├── ws/              # Socket.IO client
│       │   └── state/           # Lightweight state modules
│       ├── index.html
│       └── package.json
├── docs/                # Design documents (this folder)
├── package.json         # Workspace root
└── LICENSE
```

## 6. Key Design Decisions

1. **No frontend framework** — Primer CSS provides layout primitives and
   components. TypeScript + DOM APIs keep the bundle minimal and the code
   straightforward. If complexity grows, we can add a lightweight lib (Preact,
   Lit) later.

2. **No auth** — Rooster is a single-user admin panel running on a trusted
   network. Removing auth simplifies the server significantly (no JWT, no
   user table, no role checks).

3. **Server protocol cleanup** — The original server mixes REST verbs
   inconsistently and has routes for stripped features. Rooster defines a
   clean, minimal REST surface where every endpoint is independently testable
   with plain HTTP (see doc 02).

4. **Agent bridge untouched** — The IPC/TCP communication with the Python
   bridge is the most complex and least visible part. We inherit it verbatim
   to avoid breaking Hermes Agent compatibility.

5. **Progressive enhancement** — Start with chat working end-to-end, then
   layer admin features (profiles, skills, memory, etc.) incrementally.
