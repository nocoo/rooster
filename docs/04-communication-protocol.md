# 04 — Communication Protocol

## 1. Overview

Rooster inherits two communication paths from hermes-web-ui:

1. **Agent Bridge** (IPC/TCP socket) — primary path for chat runs
2. **Gateway Proxy** (HTTP/SSE) — alternative API-compatible path

Both are inherited verbatim. This document maps the ACTUAL protocol from
source code, not a redesign.

## 2. Agent Bridge Protocol (from `agent-bridge/client.ts`)

### Transport

- **Unix/macOS**: IPC socket at `/tmp/hermes-agent-bridge.sock`
- **Windows**: TCP socket at `tcp://127.0.0.1:18765`
- **Test**: Per-process socket (`/tmp/hermes-agent-bridge-test-${pid}.sock`)
- **Timeout**: 120,000ms default (`HERMES_AGENT_BRIDGE_TIMEOUT_MS`)

### TypeScript Types (verbatim from source)

```typescript
// Status values
type AgentBridgeStatus = 'running' | 'complete' | 'interrupted' | 'error'

// Message input (user message to agent)
type AgentBridgeMessage = string | Array<Record<string, unknown>>

// Chat options sent with a run request
interface AgentBridgeChatOptions {
  force_compress?: boolean
  storage_message?: AgentBridgeMessage
  model?: string
  provider?: string
  source?: string
  wait?: boolean
  timeout?: number
}

// Base response shape
interface AgentBridgeResponse {
  ok: true
  [key: string]: unknown
}

// Initial chat response (run started)
interface AgentBridgeChatStarted extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: AgentBridgeStatus
}

// Polling output response (incremental)
interface AgentBridgeOutput extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: AgentBridgeStatus
  delta: string          // New text since last cursor
  cursor: number         // Text cursor for next poll
  output: string         // Full accumulated output
  done: boolean          // True when run complete
  result?: unknown       // Final result data
  error?: string | null  // Error message if status='error'
  events: Array<Record<string, unknown>>  // Structured events
  event_cursor: number   // Event cursor for next poll
}

// Full run result (wait=true or after done)
interface AgentBridgeRunResult extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: AgentBridgeStatus
  output: string
  deltas: string[]
  events: unknown[]
  result?: unknown
  error?: string | null
}

// Context estimation response
interface AgentBridgeContextEstimate extends AgentBridgeResponse {
  session_id: string
  token_count?: number | null
  fixed_context_tokens?: number | null
  system_prompt_tokens?: number | null
  tool_tokens?: number | null
  message_count: number
  tool_count: number
  tool_names?: string[]
  system_prompt_chars: number
  profile?: string
  model?: string
  provider?: string
}

// Session command result
interface AgentBridgeCommandResult extends AgentBridgeResponse {
  session_id: string
  command: string
  handled: boolean
  type?: string
  message?: string
  output?: string
  notice?: string
  loaded?: string[]
  missing?: string[]
  new_session_id?: string
  history?: unknown[]
  retry?: boolean
  retry_input?: AgentBridgeMessage
  title?: string
}
```

### Request Actions (JSON payloads sent to bridge)

All 17 actions exposed by `AgentBridgeClient` (from `client.ts`):

| Action | Method | Key Fields | Response Type |
|--------|--------|-----------|---------------|
| `ping` | `ping()` | — | `AgentBridgeResponse` |
| `chat` | `chat()` | session_id, message, profile, model, provider, force_compress | `AgentBridgeChatStarted` |
| `get_output` | `getOutput()` | session_id, run_id, cursor, event_cursor | `AgentBridgeOutput` |
| `get_result` | `getResult()` | session_id, run_id | `AgentBridgeRunResult` |
| `interrupt` | `interrupt()` | session_id, run_id | `AgentBridgeResponse` |
| `steer` | `steer()` | session_id, run_id, message | `AgentBridgeResponse` |
| `command` | `command()` | session_id, command | `AgentBridgeCommandResult` |
| `context_estimate` | `contextEstimate()` | session_id | `AgentBridgeContextEstimate` |
| `approval_respond` | `approvalRespond()` | session_id, approval_id, choice | `AgentBridgeResponse` |
| `clarify_respond` | `clarifyRespond()` | session_id, clarify_id, text | `AgentBridgeResponse` |
| `compression_respond` | `compressionRespond()` | session_id, request_id, choice | `AgentBridgeResponse` |
| `get_history` | `getHistory()` | session_id | `AgentBridgeResponse` |
| `destroy` | `destroy()` | session_id | `AgentBridgeResponse` |
| `destroy_all` | `destroyAll()` | — | `AgentBridgeResponse` |
| `destroy_profile` | `destroyProfile()` | profile | `AgentBridgeResponse` |
| `list` | `list()` | — | `AgentBridgeResponse` |
| `shutdown` | `shutdown()` | — | `AgentBridgeResponse` |

### Connection Lifecycle

```
1. Open IPC/TCP connection
2. Send JSON + \n
3. Read JSON + \n (response)
4. Close connection
(repeat for each poll cycle)
```

The client uses a serialization lock (`this.lock`) to ensure only one
request is in-flight at a time per client instance.

## 3. Socket.IO Events (from `services/hermes/run-chat/`)

Namespace: `/chat-run`

### Client → Server Events

| Event | Payload Fields | Handler |
|-------|---------------|---------|
| `run` | sessionId, input, model?, provider?, profile?, forceCompress? | `run-chat/index.ts` |
| `cancel_queued_run` | queueId | `run-chat/index.ts` |
| `resume` | sessionId | `run-chat/index.ts` |
| `abort` | sessionId | `run-chat/abort.ts` |
| `approval.respond` | sessionId, approvalId, approved | `run-chat/index.ts` |
| `clarify.respond` | sessionId, requestId, text | `run-chat/index.ts` |

### Server → Client Events

All payloads include `event` (event name echo) and `session_id` (injected by
`emitToSession` helper). Fields below are additional payload keys.

Note: most fields use **snake_case** (`run_id`, `tool_call_id`, `queue_length`).
Token/context counters are the exception — they use camelCase (`inputTokens`,
`outputTokens`, `contextTokens`) matching the internal usage tracker.

| Event | Source File | Payload (additional fields) |
|-------|------------|---------|
| `run.started` | response-stream.ts, handle-bridge-run.ts | `run_id, queue_length` (+ `response_id, status` from gateway path) |
| `run.completed` | handle-bridge-run.ts | `run_id, output, result, error, inputTokens, outputTokens, contextTokens, queue_remaining` |
| `run.failed` | index.ts, handle-bridge-run.ts | `run_id?, error, inputTokens?, outputTokens?, contextTokens?, queue_remaining?` |
| `run.queued` | index.ts, abort.ts | `queue_length, queued_messages` (+ `dequeued_queue_id` on dequeue) |
| `run.peer_user_message` | handle-bridge-run.ts | `message: {id, role, content, timestamp}` |
| `message.delta` | response-stream.ts, handle-bridge-run.ts | `run_id, delta, output` (+ `response_id` from gateway) |
| `tool.started` | response-stream.ts, handle-bridge-run.ts | `run_id, tool_call_id, tool, name, arguments, preview` |
| `tool.completed` | response-stream.ts, handle-bridge-run.ts | `run_id, tool_call_id, tool, name, output, duration, error` |
| `reasoning.delta` | handle-bridge-run.ts | `run_id, text` |
| `reasoning.available` | handle-bridge-run.ts | `run_id` |
| `abort.started` | abort.ts | `run_id, graceMs` |
| `abort.completed` | abort.ts | `run_id, synced, queue_length?` (or `ignored: true` if no active run) |
| `compression.started` | handle-bridge-run.ts | `run_id, request_id, message_count, token_count, source` |
| `compression.completed` | handle-bridge-run.ts | `run_id, request_id, compressed, totalMessages, resultMessages, beforeTokens, afterTokens, contextTokens, summaryTokens, source` |
| `session.command` | index.ts | `command, ok, action, message` |
| `approval.requested` | handle-bridge-run.ts | `run_id, approval_id, command, description, choices, allow_permanent, timeout_ms` |
| `approval.resolved` | index.ts, handle-bridge-run.ts | `run_id?, approval_id, choice` |
| `clarify.requested` | handle-bridge-run.ts | `run_id, clarify_id, question, choices, timeout_ms` |
| `clarify.resolved` | index.ts, handle-bridge-run.ts | `run_id?, clarify_id` |
| `agent.event` | handle-bridge-run.ts | `run_id, ...event_fields` (generic pass-through) |
| `subagent.*` | handle-bridge-run.ts | `run_id, subagent_id, parent_id, depth, ...task_fields` |
| `resumed` | index.ts | `messages, isWorking, isAborting, events, inputTokens, outputTokens, contextTokens, queueLength, queueMessages` |

### Event Mapping: Reference → Rooster

**All events kept as-is.** No renaming. The Socket.IO protocol is the contract
between run-chat service and the frontend. Changing event names would require
coordinated changes with no benefit.

| Category | Events | Status |
|----------|--------|--------|
| Run lifecycle | `run.started`, `run.completed`, `run.failed`, `run.queued`, `run.peer_user_message` | Keep |
| Streaming | `message.delta` | Keep |
| Reasoning | `reasoning.delta`, `reasoning.available` | Keep |
| Tools | `tool.started`, `tool.completed` | Keep |
| Subagents | `subagent.*` (started, delta, tool, completed) | Keep |
| Abort | `abort.started`, `abort.completed` | Keep |
| Compression | `compression.started`, `compression.completed` | Keep |
| Commands | `session.command` | Keep |
| Approval | `approval.requested`, `approval.resolved` | Keep |
| Clarification | `clarify.requested`, `clarify.resolved` | Keep |
| Agent generic | `agent.event` | Keep |
| Session | `resumed` | Keep |

## 4. Gateway Proxy (HTTP/SSE)

When a profile has a gateway configured, the server spawns a gateway process
and proxies requests to its OpenAI-compatible endpoint.

### Upstream Endpoint

```
POST {GATEWAY_HOST}/v1/responses
Content-Type: application/json

{"model": "...", "input": [...], "stream": true}
```

### SSE Frame Format (from `run-chat/sse-utils.ts`)

```
event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"Hello"}

event: response.completed
data: {"type":"response.completed","response":{...}}
```

The server reads SSE frames via `readSseFrames()` and re-emits them as
Socket.IO events to the browser.

## 5. Data Flow

```
Browser
  │ emit('run', {sessionId, input, model, profile})
  ▼
Socket.IO Server (/chat-run namespace)
  │ run-chat/index.ts decides bridge vs gateway
  │
  ├─[Bridge path]──→ AgentBridgeClient.send({action:'chat', ...})
  │                    └─→ Poll loop (cursor/event_cursor)
  │                    └─→ Parse events, emit to socket
  │
  └─[Gateway path]─→ fetch(GATEWAY_HOST/v1/responses, {stream:true})
                       └─→ readSseFrames() → emit to socket
```

## 6. Error Handling (from source)

| Error Class | Source | Behavior |
|---|---|---|
| `AgentBridgeError` | client.ts | Thrown on bridge communication failure |
| Connection refused | client.ts (net.connect) | Retries for `connectRetryMs` then throws |
| Timeout | client.ts (setTimeout) | Throws after `timeoutMs` |
| Invalid JSON | client.ts (JSON.parse) | Throws parse error |
| `ok: false` response | Any bridge response | Wrapped in AgentBridgeError |

Server catches all bridge errors and emits `run.failed` to the Socket.IO client.

## 7. Testing Strategy

| Test Type | Target | Mock |
|---|---|---|
| Bridge protocol contract | Request/response JSON shapes | Zod schemas + fixtures |
| Bridge client unit | Connection, send, receive, timeout | net.createServer (local TCP) |
| Chat run integration | Full event sequence | Mock AgentBridgeClient (returns fixtures) |
| Gateway SSE parsing | Frame → event mapping | Mock HTTP server with canned SSE |
| Socket.IO e2e | Browser event sequence | socket.io-client + mock bridge |
