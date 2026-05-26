# 02 — Server Design

## 1. Implementation Strategy

The server is a **clean-room reimplementation** of hermes-web-ui's behavior.
No source code is copied. The reference repository is used solely to understand:

- IPC/TCP protocol (Agent Bridge actions and response shapes)
- Socket.IO event contract (event names, payload fields)
- REST API paths and request/response shapes
- Database schema (table structure and relationships)

**Framework**: Hono (lightweight, fast, TypeScript-native, Web Standard APIs).
Replaces hermes-web-ui's Koa stack.

**Package manager**: bun (fast installs, native TS execution, workspace support).

## 2. Module Architecture

### Core Services (reimplemented)

| Module | Responsibility |
|--------|---------------|
| `services/hermes/agent-bridge.ts` | IPC/TCP client to Hermes Agent bridge |
| `services/hermes/chat-run/socket.ts` | Socket.IO namespace `/chat-run` handler |
| `services/hermes/chat-run/bridge-run.ts` | Bridge path: poll → parse events → emit |
| `services/hermes/chat-run/abort.ts` | Run abort logic |
| `services/hermes/chat-run/types.ts` | Shared type definitions for chat-run |
| `services/hermes/session-store.ts` | Session CRUD |
| `services/hermes/message-store.ts` | Message persistence + pagination |
| `services/hermes/db.ts` | SQLite database initialization + schema |

### Route Modules (Hono routers)

| Module | Responsibility |
|--------|---------------|
| `routes/health.ts` | Health check + bridge connectivity probe |
| `routes/sessions.ts` | Session CRUD, conversations, messages, hermes proxy |
| `routes/bridge.ts` | Profiles/models/providers derived from bridge list |

## 3. API Route Map

All paths match hermes-web-ui's contract (`/api/hermes/*`) for Hermes Agent
compatibility. Routes are implemented incrementally by phase:

- **Phase 1**: Chat MVP — minimum routes for chat + session + profile/model
- **Phase 3**: Admin features — each route enabled as the feature ships
- **Never implemented**: Stripped features (auth, kanban, group chat, etc.)

| Route | Verb | Phase |
|---|---|---|
| `/health` | GET | 1 |
| `/api/hermes/sessions` | GET | 1 |
| `/api/hermes/sessions/:id` | GET/DELETE | 1 |
| `/api/hermes/sessions/:id/rename` | POST | 1 |
| `/api/hermes/sessions/conversations` | GET | 1 |
| `/api/hermes/sessions/conversations/:id/messages` | GET | 1 |
| `/api/hermes/sessions/conversations/:id/messages/paginated` | GET | 1 |
| `/api/hermes/sessions/hermes` | GET | 1 |
| `/api/hermes/sessions/hermes/:id` | GET | 1 |
| `/api/hermes/profiles` | GET | 1 |
| `/api/hermes/models` | GET | 1 |
| `/api/hermes/providers` | GET | 1 |
| Socket.IO `/chat-run` namespace | — | 1 |
| `/api/hermes/search/sessions` | GET | 2 |
| `/api/hermes/sessions/:id/export` | GET | 2 |
| `/api/hermes/sessions/:id/usage` | GET | 2 |
| `/api/hermes/sessions/batch-delete` | POST | 2 |
| `/upload` | POST | 2 |
| `/api/hermes/profiles` | POST/PUT/DELETE | 3 |
| `/api/hermes/providers` | PUT | 3 |
| `/api/hermes/skills` | GET/POST/DELETE | 3 |
| `/api/hermes/plugins` | GET/POST/DELETE | 3 |
| `/api/hermes/memory` | GET/DELETE | 3 |
| `/api/hermes/config` | GET/PUT | 3 |
| `/api/hermes/files` | GET | 3 |
| `/api/hermes/download` | GET | 3 |
| `/api/hermes/logs` | GET | 3 |
| `/api/hermes/jobs` | GET | 3 |
| `/api/hermes/cron-history` | GET | 3 |
| `/api/hermes/terminal` | WS | 3 |
| `/api/hermes/update` | POST | 3 |

**Never implemented**: auth, kanban, group-chat, tts, media,
performance-monitor, weixin, proxy, codex/nous/copilot/xai-auth.

## 4. Database Schema

Using **better-sqlite3** (synchronous, well-tested, no native node:sqlite
compatibility concerns).

### Tables (Phase 1)

| Table | Fields |
|-------|--------|
| `sessions` | id, profile, source, model, provider, title, started_at, ended_at, end_reason, message_count, tool_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, estimated_cost_usd, preview, last_active, workspace |
| `messages` | id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason, reasoning, reasoning_details, reasoning_content |
| `session_usage` | id, session_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, model, profile, created_at |
| `chat_compression_snapshots` | session_id, summary, last_message_index, message_count_at_time, updated_at |
| `model_context` | id, provider, model, context_limit |

**Not implemented**: users, user_profiles, gc_* tables (stripped features).

Note: `user_id` field removed from `sessions` (no auth system). Schema is
authored fresh — not inherited from hermes-web-ui's `schemas.ts`.

## 5. Security: Default Bind Address

**Default `BIND_HOST` = `127.0.0.1`** (localhost only).

If operators want remote access, they must explicitly set `BIND_HOST=0.0.0.0`
and are responsible for placing a reverse proxy (nginx/caddy) with
authentication in front.

The startup banner will print a warning when `BIND_HOST` is not localhost:

```
⚠ Rooster is binding to 0.0.0.0 — ensure access is restricted via
  reverse proxy or firewall. No authentication is built in.
```

## 6. Quality Gates

### Pre-commit Hooks

| Check | Tool | Threshold |
|-------|------|-----------|
| Lint | eslint (flat config, strict) | 0 warnings, 0 errors |
| Type check | tsc --noEmit | 0 errors |
| Unit tests | vitest | All pass |
| Coverage | vitest + v8 | 95%+ (server package) |

### Coverage Policy

- **Server**: 95%+ line coverage, no exclusions
- **Client**: 95%+ line coverage; only pure presentational wrappers excluded:
  - `pages/**` (layout/routing shells)
  - `components/**/*.view.tsx` (stateless presentational components)
- **Must be covered** (even in client): `ws/`, `api/`, `state/`, `lib/`,
  and any component with event handlers or state logic
- Coverage threshold enforced in `vitest.config.ts` — failing coverage blocks commit

### Lint Configuration

ESLint flat config with strict rules:
- `@typescript-eslint/strict-type-checked`
- No `any` without explicit cast
- No unused variables/imports
- Consistent return types
- Zero warnings tolerance (warnings treated as errors via `--max-warnings 0`)

## 7. Testability Matrix

| Layer | What to Test | How | Dependencies |
|-------|-------------|-----|-------------|
| **HTTP routes** | Request/response shape, status codes | Hono test client (`app.request()`) | Inject mock services |
| **Session store** | CRUD, search, pagination | Direct function calls | In-memory SQLite (`:memory:`) |
| **Chat run (Socket.IO)** | Event sequence, streaming | `socket.io-client` test client | Mock bridge client |
| **Agent bridge client** | JSON send/receive, timeout, reconnect | Mock TCP server (net.createServer) | No real Hermes Agent |
| **Bridge protocol** | Request/response schema validation | Zod schema + snapshot tests | Static JSON fixtures |
| **Gateway proxy** | SSE frame parsing, error handling | Mock HTTP server with SSE | No real gateway |

### Dev Commands

```
bun run test              # All unit + integration tests (vitest)
bun run test:coverage     # With coverage report + threshold check
bun run lint              # ESLint strict (0 warnings)
bun run typecheck         # tsc --noEmit
```

## 8. License

Rooster is an independent MIT-licensed project. No source code is copied from
hermes-web-ui. The reference repository is used solely to understand the
protocol and behavior for reimplementation.

```
// LICENSE
MIT License
Copyright (c) 2026 ...
```

## 9. Package Structure

```json
// root package.json
{
  "name": "rooster",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter '*' build",
    "rebuild:native": "tsx scripts/ensure-native.ts",
    "test": "bun run rebuild:native && vitest run",
    "test:coverage": "bun run rebuild:native && vitest run --coverage",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc -p packages/server --noEmit && tsc -p packages/client --noEmit && tsc --noEmit",
    "prepare": "husky"
  }
}
```

Each package declares its own dependencies (latest stable at time of init).

## 10. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8648` | Server listen port |
| `BIND_HOST` | `127.0.0.1` | Bind address (**localhost by default**) |
| `HERMES_AGENT_BRIDGE_ENDPOINT` | `/tmp/hermes-agent-bridge.sock` | Agent bridge IPC socket path (also accepts `tcp://host:port` or `ipc://path`) |
| `LOG_LEVEL` | `info` | pino log level |
