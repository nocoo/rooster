# 04 — Communication Protocol

## 1. Overview

Rooster's server communicates with Hermes Agent via two paths:

1. **Agent Bridge** (IPC/TCP socket) — primary path for chat runs
2. **Gateway Proxy** (HTTP/SSE) — alternative API-compatible path

Both are inherited from hermes-web-ui and kept unchanged to maintain
Hermes Agent compatibility.

## 2. Agent Bridge Protocol

### Transport

- **Unix/macOS**: IPC socket at `/tmp/hermes-agent-bridge.sock`
- **Windows**: TCP socket at `tcp://127.0.0.1:18765`

### Message Format

Newline-delimited JSON. One JSON object per message, terminated by `\n`.

### Request Schema

```typescript
interface BridgeRequest {
  action: 'chat' | 'abort' | 'session_command';
  
  // Chat action fields
  session_id?: string;
  message?: string | ContentBlock[];
  profile?: string;
  model?: string;
  provider?: string;
  force_compress?: boolean;
  
  // Streaming cursor (for polling incremental output)
  cursor?: number;
  event_cursor?: number;
  
  // Session command fields
  command?: string;
}
```

### Response Schema

```typescript
interface BridgeResponse {
  ok: boolean;
  
  // Run metadata
  run_id?: string;
  session_id?: string;
  status?: 'running' | 'complete' | 'interrupted' | 'error';
  
  // Content (incremental)
  delta?: string;           // New text since last cursor
  output?: string;          // Full accumulated text
  
  // Streaming cursors
  cursor?: number;          // Text cursor position
  event_cursor?: number;    // Event stream position
  done?: boolean;           // True when run is finished
  
  // Structured events (tool calls, reasoning, etc.)
  events?: BridgeEvent[];
  
  // Error info
  error?: string;
  error_code?: string;
}

interface BridgeEvent {
  type: string;             // Event type (see §4)
  data: unknown;            // Event-specific payload
  timestamp: number;
}
```

### Connection Lifecycle

```
1. Server opens IPC/TCP connection to bridge socket
2. Server sends JSON request + newline
3. Server reads JSON response + newline
4. If response.done === false:
   a. Server sends follow-up request with updated cursor/event_cursor
   b. Server reads incremental response
   c. Repeat until done === true
5. Server closes connection
```

Each chat message is a polling loop: send → read → if not done, send with
updated cursors → read → repeat.

### Streaming Polling Pattern (Server-side)

```typescript
async function* streamChat(bridge: AgentBridgeClient, params: ChatParams) {
  let cursor = 0;
  let eventCursor = 0;
  
  // Initial request
  let response = await bridge.send({
    action: 'chat',
    session_id: params.sessionId,
    message: params.message,
    profile: params.profile,
    model: params.model,
  });
  
  while (!response.done) {
    // Yield events to caller
    if (response.events?.length) {
      for (const event of response.events) {
        yield event;
      }
    }
    if (response.delta) {
      yield { type: 'message.delta', data: { delta: response.delta } };
    }
    
    // Update cursors and poll again
    cursor = response.cursor ?? cursor;
    eventCursor = response.event_cursor ?? eventCursor;
    
    await sleep(50); // Brief pause between polls
    
    response = await bridge.send({
      action: 'chat',
      session_id: params.sessionId,
      cursor,
      event_cursor: eventCursor,
    });
  }
  
  yield { type: 'run.completed', data: { output: response.output } };
}
```

## 3. Gateway Proxy (HTTP/SSE Alternative)

When a profile has a gateway configured, the server spawns a separate
gateway process and proxies requests to it.

### Upstream API

The gateway exposes an OpenAI-compatible endpoint:

```
POST /v1/responses
Content-Type: application/json

{
  "model": "...",
  "input": [...],
  "stream": true
}
```

Response: Server-Sent Events (SSE) stream with JSON frames.

### SSE Frame Format

```
event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"Hello"}

event: response.completed
data: {"type":"response.completed","response":{...}}
```

The server reads SSE frames and re-emits them as Socket.IO events to the
browser.

## 4. Socket.IO Events (Server → Browser)

Namespace: `/chat-run`

### Chat Lifecycle Events

| Event | Payload | When |
|-------|---------|------|
| `run.started` | `{ runId, sessionId }` | Chat run begins |
| `run.queued` | `{ sessionId, message }` | Message queued (agent busy) |
| `run.completed` | `{ runId, sessionId, output }` | Chat run finished |
| `run.failed` | `{ runId, error }` | Chat run errored |

### Streaming Content Events

| Event | Payload | When |
|-------|---------|------|
| `message.delta` | `{ delta: string }` | Incremental response text |
| `reasoning.delta` | `{ delta: string }` | Incremental reasoning text |
| `thinking.delta` | `{ delta: string }` | Thinking content (extended) |
| `reasoning.available` | `{ summary: string }` | Reasoning block available |

### Tool Events

| Event | Payload | When |
|-------|---------|------|
| `tool.started` | `{ toolName, toolInput, callId }` | Tool call begins |
| `tool.completed` | `{ toolName, result, callId }` | Tool call finished |

### Control Events

| Event | Payload | When |
|-------|---------|------|
| `abort.started` | `{ sessionId }` | Abort requested |
| `abort.completed` | `{ sessionId }` | Abort finished |
| `compression.started` | `{ sessionId }` | Context compression begins |
| `compression.completed` | `{ sessionId, summary }` | Compression done |
| `usage.updated` | `{ input, output, cacheRead }` | Token usage update |

### Approval/Clarification Events

| Event | Payload | When |
|-------|---------|------|
| `approval.requested` | `{ toolName, toolInput, id }` | Agent needs tool approval |
| `approval.resolved` | `{ id, approved }` | User approved/denied |
| `clarify.requested` | `{ question, id }` | Agent needs clarification |
| `clarify.resolved` | `{ id, answer }` | User answered |

## 5. Socket.IO Events (Browser → Server)

| Event | Payload | Purpose |
|-------|---------|---------|
| `chat.send` | `{ sessionId, content, profile?, model? }` | Send message |
| `chat.abort` | `{ sessionId }` | Abort current run |
| `approval.respond` | `{ id, approved }` | Answer tool approval |
| `clarify.respond` | `{ id, answer }` | Answer clarification |

## 6. Data Flow Diagram

```
User types message
       │
       ▼
[Browser] ──emit('chat.send')──→ [Socket.IO Server]
                                        │
                                        ▼
                                [ChatRunService]
                                        │
                          ┌─────────────┼─────────────┐
                          ▼                           ▼
                   [AgentBridge]              [GatewayProxy]
                   (IPC polling)             (HTTP/SSE stream)
                          │                           │
                          ▼                           ▼
                   [Hermes Agent]            [Hermes Gateway]
                          │                           │
                          └─────────┬─────────────────┘
                                    │ responses
                                    ▼
                            [ChatRunService]
                                    │
                                    ▼ emit Socket.IO events
                            [Browser updates UI]
```

## 7. Error Handling

| Scenario | Bridge Behavior | Server Action |
|----------|----------------|---------------|
| Bridge socket unreachable | Connection refused | Emit `run.failed` with "Agent not running" |
| Bridge returns `ok: false` | Error in response | Emit `run.failed` with error message |
| Bridge timeout (>60s no response) | Stale connection | Abort, emit `run.failed` |
| Gateway SSE disconnects | Stream ends early | Emit `run.failed` with "Connection lost" |
| Invalid JSON from bridge | Parse error | Log, emit `run.failed` |

## 8. Testing Strategy for Protocol

1. **Unit tests**: Mock the IPC socket. Send known JSON, assert correct
   Socket.IO events are emitted.
2. **Integration tests**: Spawn a mock Python bridge (simple script that
   echoes fixed responses), verify full round-trip.
3. **Contract tests**: Validate request/response JSON shapes against the
   schemas above using zod or similar runtime validation.
