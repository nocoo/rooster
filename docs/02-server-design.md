# 02 — Server Design

## 1. Inheritance Strategy

The server is **inherited** from hermes-web-ui's `packages/server/src/` with
surgical removal of stripped features. The core Hermes communication layer
(AgentBridge, GatewayManager, run-chat) is kept verbatim. Routes are
reorganized for clarity and testability.

**Important**: hermes-web-ui is a single-package monolith (no workspace).
`packages/server/` is a source directory sharing the root `package.json`.
Rooster will restructure into a proper npm workspace.

## 2. Source File Map (Precise Paths from Reference)

### Core Services — Inherit Verbatim

| Module | Source Path (reference) | Purpose |
|--------|------------------------|---------|
| run-chat/index.ts | `packages/server/src/services/hermes/run-chat/index.ts` | Chat run orchestrator + Socket.IO namespace |
| run-chat/handle-bridge-run.ts | `.../run-chat/handle-bridge-run.ts` | Bridge chat execution loop |
| run-chat/handle-api-run.ts | `.../run-chat/handle-api-run.ts` | Gateway/SSE chat execution |
| run-chat/abort.ts | `.../run-chat/abort.ts` | Abort logic |
| run-chat/bridge-delta.ts | `.../run-chat/bridge-delta.ts` | Incremental delta processing |
| run-chat/bridge-message.ts | `.../run-chat/bridge-message.ts` | Bridge message formatting |
| run-chat/compression.ts | `.../run-chat/compression.ts` | Context compression |
| run-chat/content-blocks.ts | `.../run-chat/content-blocks.ts` | Content block parsing |
| run-chat/message-format.ts | `.../run-chat/message-format.ts` | Message serialization |
| run-chat/model-config.ts | `.../run-chat/model-config.ts` | Model configuration |
| run-chat/response-stream.ts | `.../run-chat/response-stream.ts` | SSE response streaming |
| run-chat/response-utils.ts | `.../run-chat/response-utils.ts` | Response helpers |
| run-chat/session-command.ts | `.../run-chat/session-command.ts` | Session command handling |
| run-chat/sse-utils.ts | `.../run-chat/sse-utils.ts` | SSE frame parsing |
| run-chat/types.ts | `.../run-chat/types.ts` | Type definitions |
| run-chat/usage.ts | `.../run-chat/usage.ts` | Token usage tracking |
| agent-bridge/index.ts | `packages/server/src/services/hermes/agent-bridge/index.ts` | Module exports |
| agent-bridge/client.ts | `.../agent-bridge/client.ts` | IPC/TCP bridge client |
| agent-bridge/manager.ts | `.../agent-bridge/manager.ts` | Bridge process lifecycle |
| agent-bridge/hermes_bridge.py | `.../agent-bridge/hermes_bridge.py` | Python bridge subprocess |
| gateway-manager.ts | `packages/server/src/services/hermes/gateway-manager.ts` | Gateway process management |

### Database Layer — Inherit with Selective Table Removal

| Module | Source Path (reference) | Purpose | Keep? |
|--------|------------------------|---------|-------|
| db/index.ts | `packages/server/src/db/index.ts` | DB init, getDb() | ✓ |
| db/hermes/init.ts | `.../db/hermes/init.ts` | Table initialization | ✓ (trimmed) |
| db/hermes/schemas.ts | `.../db/hermes/schemas.ts` | All table schemas | ✓ (trimmed) |
| db/hermes/session-store.ts | `.../db/hermes/session-store.ts` | Session CRUD | ✓ |
| db/hermes/sessions-db.ts | `.../db/hermes/sessions-db.ts` | Session queries | ✓ |
| db/hermes/conversations-db.ts | `.../db/hermes/conversations-db.ts` | Conversation/message queries | ✓ |
| db/hermes/message-content.ts | `.../db/hermes/message-content.ts` | Message content handling | ✓ |
| db/hermes/usage-store.ts | `.../db/hermes/usage-store.ts` | Token usage persistence | ✓ |
| db/hermes/compression-snapshot.ts | `.../db/hermes/compression-snapshot.ts` | Compression state | ✓ |
| db/hermes/users-store.ts | `.../db/hermes/users-store.ts` | User management | ✗ Remove |

### Route Files — Keep / Remove Decision

| Route File | Source Path | Keep? | Notes |
|-----------|------------|-------|-------|
| routes/health.ts | `packages/server/src/routes/health.ts` | ✓ | |
| routes/upload.ts | `.../routes/upload.ts` | ✓ | |
| routes/update.ts | `.../routes/update.ts` | ✓ | |
| routes/webhook.ts | `.../routes/webhook.ts` | ✓ | |
| routes/hermes/chat-run.ts | `.../routes/hermes/chat-run.ts` | ✓ | Socket.IO getter/setter only |
| routes/hermes/sessions.ts | `.../routes/hermes/sessions.ts` | ✓ | |
| routes/hermes/profiles.ts | `.../routes/hermes/profiles.ts` | ✓ | |
| routes/hermes/skills.ts | `.../routes/hermes/skills.ts` | ✓ | |
| routes/hermes/plugins.ts | `.../routes/hermes/plugins.ts` | ✓ | |
| routes/hermes/memory.ts | `.../routes/hermes/memory.ts` | ✓ | |
| routes/hermes/models.ts | `.../routes/hermes/models.ts` | ✓ | |
| routes/hermes/providers.ts | `.../routes/hermes/providers.ts` | ✓ | |
| routes/hermes/config.ts | `.../routes/hermes/config.ts` | ✓ | |
| routes/hermes/files.ts | `.../routes/hermes/files.ts` | ✓ | |
| routes/hermes/download.ts | `.../routes/hermes/download.ts` | ✓ | |
| routes/hermes/logs.ts | `.../routes/hermes/logs.ts` | ✓ | |
| routes/hermes/jobs.ts | `.../routes/hermes/jobs.ts` | ✓ | |
| routes/hermes/cron-history.ts | `.../routes/hermes/cron-history.ts` | ✓ | |
| routes/hermes/terminal.ts | `.../routes/hermes/terminal.ts` | ✓ | |
| routes/auth.ts | `.../routes/auth.ts` | ✗ | Auth removed |
| routes/hermes/kanban.ts | `.../routes/hermes/kanban.ts` | ✗ | Stripped |
| routes/hermes/kanban-events.ts | `.../routes/hermes/kanban-events.ts` | ✗ | Stripped |
| routes/hermes/group-chat.ts | `.../routes/hermes/group-chat.ts` | ✗ | Stripped |
| routes/hermes/tts.ts | `.../routes/hermes/tts.ts` | ✗ | Stripped |
| routes/hermes/media.ts | `.../routes/hermes/media.ts` | ✗ | Stripped |
| routes/hermes/performance-monitor.ts | `.../routes/hermes/performance-monitor.ts` | ✗ | Stripped |
| routes/hermes/weixin.ts | `.../routes/hermes/weixin.ts` | ✗ | Stripped |
| routes/hermes/proxy.ts | `.../routes/hermes/proxy.ts` | ✗ | Stripped |
| routes/hermes/proxy-handler.ts | `.../routes/hermes/proxy-handler.ts` | ✗ | Stripped |
| routes/hermes/codex-auth.ts | `.../routes/hermes/codex-auth.ts` | ✗ | Stripped |
| routes/hermes/nous-auth.ts | `.../routes/hermes/nous-auth.ts` | ✗ | Stripped |
| routes/hermes/copilot-auth.ts | `.../routes/hermes/copilot-auth.ts` | ✗ | Stripped |
| routes/hermes/xai-auth.ts | `.../routes/hermes/xai-auth.ts` | ✗ | Stripped |

## 3. API Route Map (Old → New)

Phase 1 keeps ALL existing paths unchanged (`/api/hermes/*`). No renaming.
This ensures existing Hermes Agent integrations and any client code works
without modification during development.

| Current Route | Verb | Keep | Rooster Route (same) |
|---|---|---|---|
| `/api/hermes/sessions` | GET | ✓ | `/api/hermes/sessions` |
| `/api/hermes/sessions/:id` | GET | ✓ | `/api/hermes/sessions/:id` |
| `/api/hermes/sessions/:id` | DELETE | ✓ | `/api/hermes/sessions/:id` |
| `/api/hermes/sessions/batch-delete` | POST | ✓ | `/api/hermes/sessions/batch-delete` |
| `/api/hermes/sessions/:id/rename` | POST | ✓ | `/api/hermes/sessions/:id/rename` |
| `/api/hermes/sessions/:id/model` | POST | ✓ | `/api/hermes/sessions/:id/model` |
| `/api/hermes/sessions/:id/workspace` | POST | ✓ | `/api/hermes/sessions/:id/workspace` |
| `/api/hermes/sessions/:id/export` | GET | ✓ | `/api/hermes/sessions/:id/export` |
| `/api/hermes/sessions/:id/usage` | GET | ✓ | `/api/hermes/sessions/:id/usage` |
| `/api/hermes/sessions/conversations` | GET | ✓ | `/api/hermes/sessions/conversations` |
| `/api/hermes/sessions/conversations/:id/messages` | GET | ✓ | same |
| `/api/hermes/sessions/conversations/:id/messages/paginated` | GET | ✓ | same |
| `/api/hermes/sessions/hermes` | GET | ✓ | same |
| `/api/hermes/sessions/hermes/:id` | GET | ✓ | same |
| `/api/hermes/search/sessions` | GET | ✓ | same |
| `/api/hermes/sessions/search` | GET | ✓ | same (alias) |
| `/api/hermes/sessions/usage` | GET | ✓ | same |
| `/api/hermes/sessions/context-length` | GET | ✓ | same |
| `/api/hermes/workspace/folders` | GET | ✓ | same |
| `/api/hermes/profiles` | GET/POST/PUT/DELETE | ✓ | same |
| `/api/hermes/skills` | GET/POST/DELETE | ✓ | same |
| `/api/hermes/plugins` | GET/POST/DELETE | ✓ | same |
| `/api/hermes/memory` | GET/DELETE | ✓ | same |
| `/api/hermes/models` | GET | ✓ | same |
| `/api/hermes/providers` | GET/PUT | ✓ | same |
| `/api/hermes/config` | GET/PUT | ✓ | same |
| `/api/hermes/files` | GET | ✓ | same |
| `/api/hermes/download` | GET | ✓ | same |
| `/api/hermes/logs` | GET | ✓ | same |
| `/api/hermes/jobs` | GET | ✓ | same |
| `/api/hermes/cron-history` | GET | ✓ | same |
| `/upload` | POST | ✓ | same |
| `/health` | GET | ✓ | same |
| `/api/hermes/update` | POST | ✓ | same |
| `/api/hermes/terminal` | WS | ✓ | same |

**Only change**: Remove JWT auth middleware from the route chain. All routes
become publicly accessible (trusted network assumption).

## 4. Database Schema (Inherited — Keep / Remove)

From `db/hermes/schemas.ts`:

### Tables to Keep (verbatim schema)

| Table | Fields | Notes |
|-------|--------|-------|
| `sessions` | id, profile, source, user_id, model, provider, title, started_at, ended_at, end_reason, message_count, tool_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, billing_provider, estimated_cost_usd, actual_cost_usd, cost_status, preview, last_active, workspace | Keep user_id field for future compatibility, just don't enforce |
| `messages` | id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, token_count, finish_reason, reasoning, reasoning_details, reasoning_content | |
| `session_usage` | id, session_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, model, profile, created_at | |
| `chat_compression_snapshots` | session_id, summary, last_message_index, message_count_at_time, updated_at | |
| `model_context` | id, provider, model, context_limit | |

### Tables to Remove

| Table | Reason |
|-------|--------|
| `users` | No auth |
| `user_profiles` | No auth |
| `gc_rooms` | Group chat stripped |
| `gc_messages` | Group chat stripped |
| `gc_room_agents` | Group chat stripped |
| `gc_context_snapshots` | Group chat stripped |
| `gc_room_members` | Group chat stripped |
| `gc_pending_session_deletes` | Group chat stripped |
| `gc_session_profiles` | Group chat stripped |

### Migration Approach

Since Rooster starts fresh (no existing data), we simply omit the removed
tables from `initAllHermesTables()`. No migration needed. The `syncTable()`
utility is inherited as-is for future schema evolution.

## 5. Security: Default Bind Address

**Default `BIND_HOST` = `127.0.0.1`** (localhost only).

If operators want remote access, they must explicitly set `BIND_HOST=0.0.0.0`
and are responsible for placing a reverse proxy (nginx/caddy) with
authentication in front.

The docs and startup banner will print a warning when `BIND_HOST` is not
localhost:

```
⚠ Rooster is binding to 0.0.0.0 — ensure access is restricted via
  reverse proxy or firewall. No authentication is built in.
```

## 6. Testability Matrix

| Layer | What to Test | How | Dependencies |
|-------|-------------|-----|-------------|
| **HTTP routes** | Request/response shape, status codes | Supertest + Koa app instance | Inject mock services |
| **Session store** | CRUD, search, pagination | Direct function calls | In-memory SQLite (`:memory:`) |
| **Chat run (Socket.IO)** | Event sequence, streaming | `socket.io-client` test client | Mock AgentBridgeClient |
| **AgentBridge client** | JSON send/receive, timeout, reconnect | Mock TCP server (net.createServer) | No real Hermes Agent |
| **Bridge protocol** | Request/response schema validation | Zod schema + snapshot tests | Static JSON fixtures |
| **Gateway proxy** | SSE frame parsing, error handling | Mock HTTP server with SSE | No real gateway |

### CI/Dev Verification (No Real Hermes Agent Required)

```
npm test                  # All unit + integration tests
npm run test:bridge       # Bridge protocol contract tests (mock socket)
npm run test:chat         # Socket.IO chat flow (mock bridge)
npm run test:routes       # HTTP route tests (in-memory DB)
```

## 7. License / Notice

hermes-web-ui is licensed BSL-1.1 (Business Source License 1.1). Per BSL-1.1
terms:

- Source code can be copied and modified for internal/non-production use
- Rooster will include the original LICENSE and NOTICE in the repository
- `package.json` will reference the upstream origin
- If Rooster is distributed or offered as a service, BSL-1.1 change date
  and production use terms apply

A `NOTICE` file will be added at repo root documenting the derivation.

## 8. Package Structure

Rooster uses **npm workspaces** (unlike hermes-web-ui's monolith):

```json
// root package.json
{
  "name": "rooster",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/server",
    "build": "npm run build --workspace=packages/server && npm run build --workspace=packages/client",
    "test": "vitest run"
  }
}
```

Each package (`packages/server/package.json`, `packages/client/package.json`)
declares its own dependencies. This enables:
- Independent versioning
- Separate test configs
- Clean dependency boundaries
- Parallel builds

## 9. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8648` | Server listen port |
| `BIND_HOST` | `127.0.0.1` | Bind address (**localhost by default**) |
| `ROOSTER_HOME` | `~/.rooster` | Data directory (DB, logs) |
| `HERMES_AGENT_BRIDGE_ENDPOINT` | `ipc:///tmp/hermes-agent-bridge.sock` | Agent bridge IPC path |
| `GATEWAY_HOST` | (none) | Hermes gateway upstream (optional) |
| `LOG_LEVEL` | `info` | pino log level |
| `WORKSPACE_BASE` | `.` | File browser root |
