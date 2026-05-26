# 04 — Communication Protocol

## 1. Overview

Rooster's communication with Hermes Agent uses the **Agent Bridge** protocol
(IPC/TCP socket). This is the only path implemented in Phase 1.

1. **Agent Bridge** (IPC/TCP socket) — primary path for chat runs (**implemented**)
2. **Gateway Proxy** (HTTP/SSE) — alternative API-compatible path (**future, not Phase 1**)

This document specifies the protocol contract that Rooster must implement.
Field names, action strings, and event payloads are derived from observation
of hermes-web-ui's actual wire behavior.

## 2. Agent Bridge Protocol

### Transport

- **Unix/macOS**: IPC socket at `/tmp/hermes-agent-bridge.sock`
- **Windows**: TCP socket at `tcp://127.0.0.1:18765`
- **Test**: Per-process socket (`/tmp/hermes-agent-bridge-test-${pid}.sock`)
- **Timeout**: 120,000ms default (`HERMES_AGENT_BRIDGE_TIMEOUT_MS`)

### Response Types

```typescript
type AgentBridgeStatus = 'running' | 'complete' | 'interrupted' | 'error'

type AgentBridgeMessage = string | Array<Record<string, unknown>>

interface AgentBridgeResponse {
  ok: true
  [key: string]: unknown
}

interface AgentBridgeChatStarted extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: AgentBridgeStatus
}

interface AgentBridgeOutput extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: AgentBridgeStatus
  delta: string
  cursor: number
  output: string
  done: boolean
  result?: unknown
  error?: string | null
  events: Array<Record<string, unknown>>
  event_cursor: number
}

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

### Request Actions (17 total)

All requests are JSON objects with an `action` field. Wire format: JSON + `\n`.

| Action | Wire Payload Fields | Response |
|--------|-------------------|----------|
| `ping` | — | `AgentBridgeResponse` |
| `chat` | `session_id, message, profile?, model?, provider?, force_compress?, source?, wait?, timeout?, instructions?, storage_message?, conversation_history?` | `AgentBridgeChatStarted` |
| `get_output` | `run_id, cursor, event_cursor` | `AgentBridgeOutput` |
| `get_result` | `run_id` | `AgentBridgeRunResult` |
| `interrupt` | `session_id, message?, profile?` | `AgentBridgeResponse` |
| `steer` | `session_id, text, profile?` | `AgentBridgeResponse` |
| `command` | `session_id, command` | `AgentBridgeCommandResult` |
| `context_estimate` | `session_id, messages?, instructions?, profile?, model?, provider?` | `AgentBridgeContextEstimate` |
| `approval_respond` | `approval_id, choice` | `AgentBridgeResponse` |
| `clarify_respond` | `clarify_id, response` | `AgentBridgeResponse` |
| `compression_respond` | `request_id, messages?, system_message?, error?` | `AgentBridgeResponse` |
| `get_history` | `session_id, profile?` | `AgentBridgeResponse` |
| `destroy` | `session_id, profile?` | `AgentBridgeResponse` |
| `destroy_all` | — | `AgentBridgeResponse` |
| `destroy_profile` | `profile` | `AgentBridgeResponse` |
| `list` | — | `AgentBridgeResponse` |
| `shutdown` | — | `AgentBridgeResponse` |

### Connection Lifecycle

```
1. Open IPC/TCP connection
2. Send JSON + \n
3. Read JSON + \n (response)
4. Close connection
(repeat for each request — one request per connection)
```

The client uses a serialization lock to ensure only one request is in-flight
at a time per client instance.

## 3. Socket.IO Events

Namespace: `/chat-run`

### Client → Server Events

All fields use **snake_case**.

| Event | Payload Fields |
|-------|---------------|
| `run` | `input, session_id?, display_input?, display_role?, storage_message?, model?, provider?, profile?, instructions?, model_groups?, queue_id?, source?` |
| `cancel_queued_run` | `session_id, queue_id` |
| `resume` | `session_id` |
| `abort` | `session_id` |
| `approval.respond` | `session_id, approval_id, choice` |
| `clarify.respond` | `session_id, clarify_id, response` |

### Server → Client Events

All payloads include `event` (event name echo) and `session_id` (injected by
the session-scoped emit helper). Fields below are the additional payload keys.

Naming convention: IDs and most fields use **snake_case** (`run_id`,
`tool_call_id`, `queue_length`). Token/context counters are the exception —
they use camelCase (`inputTokens`, `outputTokens`, `contextTokens`).

| Event | Payload (additional fields) |
|-------|---------|
| `run.started` | `run_id, queue_length` |
| `run.completed` | `run_id, output, result, error, inputTokens, outputTokens, contextTokens, queue_remaining` |
| `run.failed` | `run_id?, error, inputTokens?, outputTokens?, contextTokens?, queue_remaining?` |
| `run.queued` | `queue_length, queued_messages` (+ `dequeued_queue_id` on dequeue) |
| `run.peer_user_message` | `message: {id, role, content, timestamp}` |
| `message.delta` | `run_id, delta, output` |
| `tool.started` | `run_id, tool_call_id, tool, name, arguments, preview` |
| `tool.completed` | `run_id, tool_call_id, tool, name, output, duration, error` |
| `reasoning.delta` | `run_id, text` |
| `reasoning.available` | `run_id` |
| `abort.started` | `run_id, graceMs` |
| `abort.completed` | `run_id, synced, queue_length?` (or `ignored: true`) |
| `compression.started` | `run_id, request_id, message_count, token_count, source` |
| `compression.completed` | `run_id, request_id, compressed, totalMessages, resultMessages, beforeTokens, afterTokens, contextTokens, summaryTokens, source` |
| `session.command` | `command, ok, action, message` |
| `approval.requested` | `run_id, approval_id, command, description, choices, allow_permanent, timeout_ms` |
| `approval.resolved` | `run_id?, approval_id, choice` |
| `clarify.requested` | `run_id, clarify_id, question, choices, timeout_ms` |
| `clarify.resolved` | `run_id?, clarify_id` |
| `agent.event` | `run_id, ...event_fields` (generic pass-through) |
| `subagent.*` | `run_id, subagent_id, parent_id, depth, ...task_fields` |
| `resumed` | `messages, isWorking, isAborting, events, inputTokens, outputTokens, contextTokens, queueLength, queueMessages` |

### Event Categories

| Category | Events |
|----------|--------|
| Run lifecycle | `run.started`, `run.completed`, `run.failed`, `run.queued`, `run.peer_user_message` |
| Streaming | `message.delta` |
| Reasoning | `reasoning.delta`, `reasoning.available` |
| Tools | `tool.started`, `tool.completed` |
| Subagents | `subagent.*` (started, delta, tool, completed) |
| Abort | `abort.started`, `abort.completed` |
| Compression | `compression.started`, `compression.completed` |
| Commands | `session.command` |
| Approval | `approval.requested`, `approval.resolved` |
| Clarification | `clarify.requested`, `clarify.resolved` |
| Agent generic | `agent.event` |
| Session | `resumed` |

## 4. Gateway Proxy (HTTP/SSE) — NOT IMPLEMENTED (Future)

> **Status**: Documented for reference only. Not implemented in Phase 1.
> When a profile has a gateway configured, the server would proxy requests to
> its OpenAI-compatible endpoint. This will be implemented in a future phase.

### Upstream Endpoint

```
POST {GATEWAY_HOST}/v1/responses
Content-Type: application/json

{"model": "...", "input": [...], "stream": true}
```

### SSE Frame Format

```
event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"Hello"}

event: response.completed
data: {"type":"response.completed","response":{...}}
```

The server would read SSE frames and re-emit them as Socket.IO events to the
browser client.

## 5. Data Flow

```
Browser
  │ emit('run', {session_id, input, model, profile})
  ▼
Socket.IO Server (/chat-run namespace)
  │
  └─[Bridge path]──→ bridge.chat({session_id, message, ...})
                       └─→ bridge.getOutput(run_id, cursor, event_cursor)
                       └─→ Poll loop: parse events, emit to socket
                       └─→ Until chunk.done === true
```

> **Future**: Gateway path (`fetch(GATEWAY_HOST/v1/responses, {stream:true})
> → Parse SSE frames → emit to socket`) will be added when gateway support
> ships.

## 6. Error Handling

| Error Condition | Behavior |
|---|---|
| Bridge connection refused | Retry for `connectRetryMs`, then throw |
| Bridge timeout | Throw after `timeoutMs` (default 120s) |
| Bridge invalid JSON | Throw parse error |
| Bridge `ok: false` response | Throw AgentBridgeError |
| Any bridge error during run | Emit `run.failed` to Socket.IO client |
| Gateway fetch failure | Emit `run.failed` to Socket.IO client |
| Gateway SSE parse error | Emit `run.failed` to Socket.IO client |

## 7. Testing Strategy

| Test Type | Target | Approach | Status |
|---|---|---|---|
| Bridge protocol contract | Request/response JSON shapes | Zod schemas + snapshot tests | Phase 1 |
| Bridge client unit | Connection, send, receive, timeout | Mock TCP server (net.createServer) | Phase 1 |
| Chat run integration | Full event sequence | Mock bridge client (returns fixtures) | Phase 1 |
| Gateway SSE parsing | Frame → event mapping | Mock HTTP server with canned SSE | **Future** |
| Socket.IO e2e | Browser event sequence | socket.io-client + mock bridge | Phase 1 |
