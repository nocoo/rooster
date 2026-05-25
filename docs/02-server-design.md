# 02 — Server Design

## 1. Inheritance Strategy

The server is **inherited** from hermes-web-ui with surgical removal of
stripped features. The core Hermes communication layer (AgentBridge,
GatewayManager) is kept verbatim. Routes are reorganized for clarity and
testability.

## 2. What to Keep from hermes-web-ui Server

### Core Services (inherit as-is)

| Service | Path | Purpose |
|---------|------|---------|
| AgentBridgeManager | `services/hermes/agent-bridge/` | Spawn & manage Python bridge process |
| AgentBridgeClient | `services/hermes/agent-bridge/` | IPC/TCP socket communication |
| GatewayManager | `services/hermes/gateway-manager.ts` | Per-profile gateway process management |
| ChatRunService | `services/hermes/chat-run.ts` | Orchestrate chat message flow |
| SessionStore | `services/hermes/session-store.ts` | SQLite session/message persistence |
| SkillInjector | `services/hermes/skill-injector.ts` | Inject bundled skills into profiles |

### Routes (keep, reorganize)

| Endpoint Group | Method | Purpose |
|---|---|---|
| `GET /api/health` | GET | Health check |
| `GET /api/sessions` | GET | List sessions |
| `POST /api/sessions` | POST | Create session |
| `GET /api/sessions/:id` | GET | Get session detail + messages |
| `DELETE /api/sessions/:id` | DELETE | Delete session |
| `POST /api/sessions/search` | POST | Full-text search sessions |
| `POST /api/sessions/batch-delete` | POST | Bulk delete |
| `GET /api/profiles` | GET | List profiles |
| `GET /api/profiles/:name` | GET | Get profile detail |
| `POST /api/profiles` | POST | Create profile |
| `PUT /api/profiles/:name` | PUT | Update profile |
| `DELETE /api/profiles/:name` | DELETE | Delete profile |
| `GET /api/skills` | GET | List skills |
| `POST /api/skills` | POST | Create/update skill |
| `DELETE /api/skills/:name` | DELETE | Delete skill |
| `GET /api/plugins` | GET | List plugins |
| `POST /api/plugins` | POST | Install plugin |
| `DELETE /api/plugins/:name` | DELETE | Remove plugin |
| `GET /api/memory` | GET | List memory entries |
| `DELETE /api/memory/:id` | DELETE | Delete memory entry |
| `GET /api/models` | GET | List available models |
| `GET /api/providers` | GET | List providers |
| `PUT /api/providers/:name` | PUT | Update provider config |
| `GET /api/config` | GET | Get runtime config |
| `PUT /api/config` | PUT | Update runtime config |
| `GET /api/files` | GET | List files in workspace |
| `GET /api/files/download` | GET | Download file |
| `POST /api/upload` | POST | Upload file |
| `GET /api/logs` | GET | Stream/list log entries |
| `GET /api/jobs` | GET | List background jobs |
| `GET /api/jobs/:id` | GET | Get job detail |
| `POST /api/update/check` | POST | Check for updates |
| `POST /api/update/apply` | POST | Apply update |

### WebSocket Endpoints (keep)

| Endpoint | Protocol | Purpose |
|---|---|---|
| `/socket.io` namespace `/chat-run` | Socket.IO | Chat streaming + events |
| `/api/terminal` | raw WebSocket (ws) | xterm.js terminal |

## 3. What to Remove

| Route/Service | Reason |
|---|---|
| `/api/auth/*` (login, register, refresh) | No auth in Rooster |
| Auth middleware (JWT verification) | Removed entirely |
| User table / user store | No users |
| `/api/hermes/kanban`, kanban WebSocket | Stripped feature |
| `/api/hermes/group-chat`, group-chat Socket.IO | Stripped feature |
| `/api/hermes/performance-monitor` | Stripped feature |
| `/api/hermes/tts/*` | Stripped feature (voice) |
| `/api/hermes/weixin` | Stripped feature (channels) |
| `/api/hermes/media` (image-gen, video) | Stripped feature |
| Codex/Nous/Copilot/xai OAuth routes | Stripped feature (API relay) |
| `/v1/*` gateway proxy catch-all | Keep only if needed for chat; evaluate |

## 4. Database Schema (Simplified)

Only tables needed for core functionality:

```sql
-- Session metadata
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  profile TEXT NOT NULL,
  model TEXT,
  provider TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Chat messages within a session
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,          -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,       -- JSON (text or content blocks)
  tool_use TEXT,               -- JSON array of tool calls (nullable)
  created_at INTEGER NOT NULL
);

-- Token usage per session
CREATE TABLE session_usage (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Context compression snapshots
CREATE TABLE chat_compression_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## 5. Server Testability Contract

Every route handler must be independently testable:

1. **No global state** — Route handlers receive dependencies via DI
   (services injected into Koa context at boot).
2. **Service interfaces** — Each service exposes a typed interface. Tests
   can mock at the service boundary.
3. **AgentBridge abstraction** — Chat tests mock the bridge client at the
   socket level (send JSON, receive JSON) without needing a real Hermes Agent.
4. **No auth overhead** — Removing JWT means test HTTP calls need no token
   setup. Tests hit routes directly.

```typescript
// Example: testable route handler pattern
export function createSessionRoutes(deps: {
  sessionStore: SessionStore;
}) {
  const router = new Router({ prefix: '/api/sessions' });
  
  router.get('/', async (ctx) => {
    const sessions = await deps.sessionStore.list(ctx.query);
    ctx.body = sessions;
  });
  
  return router;
}
```

## 6. Configuration

Rooster server uses environment variables (inherited pattern):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8648` | Server listen port |
| `BIND_HOST` | `0.0.0.0` | Bind address |
| `ROOSTER_HOME` | `~/.rooster` | Data directory (DB, logs) |
| `HERMES_BRIDGE_SOCKET` | `/tmp/hermes-agent-bridge.sock` | Agent bridge IPC path |
| `GATEWAY_HOST` | `http://127.0.0.1:5678` | Hermes gateway upstream |
| `LOG_LEVEL` | `info` | pino log level |
| `WORKSPACE_BASE` | `.` | File browser root |

## 7. Migration Plan

1. Copy `packages/server/` from hermes-web-ui into rooster
2. Delete auth middleware, user routes, user store
3. Delete stripped-feature routes and services (kanban, group-chat, tts,
   media, performance-monitor, weixin, OAuth flows)
4. Remove JWT token checks from remaining routes
5. Reorganize route registration (single clean `routes/index.ts`)
6. Add service DI pattern to route constructors
7. Write integration tests for each route group against SQLite in-memory DB
8. Verify chat flow works end-to-end with a mock bridge
