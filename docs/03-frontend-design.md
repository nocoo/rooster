# 03 — Frontend Design

## 1. Technology Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Bundler | Vite | Fast, modern, already used by hermes-web-ui |
| Language | TypeScript | Type safety, IDE support |
| UI framework | None (vanilla TS + DOM) | Minimal bundle, Primer handles layout |
| CSS | Primer CSS (@primer/css) | GitHub's battle-tested design system; provides utility classes, components, and dark mode |
| State | Module-scoped stores + CustomEvent | Simple, no library needed for single-user app |
| Routing | History API wrapper (custom, ~50 LOC) | SPA with few routes; no need for vue-router |
| Markdown | markdown-it + highlight.js + KaTeX | Essential for rendering AI responses |
| Terminal | @xterm/xterm | Terminal emulation (inherited need) |
| Real-time | socket.io-client | Chat streaming (must match server) |
| Icons | Primer Octicons (@primer/octicons) | Matches Primer CSS aesthetic |

## 2. Page Structure

```
/                         → Chat (default, redirects to last session or new)
/session/:id              → Chat with specific session
/history                  → Session history / search
/profiles                 → Profile management
/skills                   → Skills management
/plugins                  → Plugins
/memory                   → Agent memory browser
/models                   → Models & providers
/files                    → File browser
/terminal                 → Terminal
/logs                     → Log viewer
/jobs                     → Background jobs
/settings                 → Runtime config
```

## 3. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (collapsible)  │  Main Content                  │
│                        │                                 │
│ [Chat]                 │  ┌─────────────────────────┐   │
│ [History]              │  │  Page header / toolbar   │   │
│ [Profiles]             │  ├─────────────────────────┤   │
│ [Skills]               │  │                         │   │
│ [Plugins]              │  │  Page content            │   │
│ [Memory]               │  │                         │   │
│ [Models]               │  │                         │   │
│ [Files]                │  │                         │   │
│ [Terminal]             │  │                         │   │
│ [Logs]                 │  │                         │   │
│ [Jobs]                 │  └─────────────────────────┘   │
│ [Settings]             │                                 │
└────────────────────────┴─────────────────────────────────┘
```

- Sidebar uses Primer's `ActionList` / `NavList` pattern
- Main content area is a simple container that swaps per route
- Responsive: sidebar collapses on mobile

## 4. Chat Page — Core UI

The chat page is the primary surface. Structure:

```
┌─────────────────────────────────────────────┐
│ Session title        [Model] [Profile] [⚙]  │  ← Header bar
├─────────────────────────────────────────────┤
│                                             │
│  [Assistant message with markdown]          │
│                                             │
│  [User message]                             │
│                                             │
│  [Assistant streaming...]                   │
│    ├─ [Reasoning block, collapsible]        │
│    ├─ [Tool use trace, collapsible]         │
│    └─ [Response text, streaming]            │
│                                             │
├─────────────────────────────────────────────┤
│ [Input area]                    [Send] [⏹]  │  ← Input bar
│ [Attach file]                               │
└─────────────────────────────────────────────┘
```

### Key Chat Components

| Component | Responsibility |
|-----------|---------------|
| `ChatView` | Page-level container, manages session lifecycle |
| `MessageList` | Scrollable message container, auto-scroll |
| `MessageBubble` | Single message render (markdown, code, images) |
| `ReasoningBlock` | Collapsible reasoning/thinking display |
| `ToolTrace` | Tool call + result display (collapsible) |
| `ChatInput` | Textarea + file attach + send/abort buttons |
| `SessionHeader` | Session title, model selector, profile badge |

### Streaming Behavior

1. User sends message → `ChatInput` emits to Socket.IO
2. Server streams back events via Socket.IO `/chat-run` namespace
3. `MessageList` appends a streaming `MessageBubble` that grows as
   `message.delta` events arrive
4. Tool traces appear inline as `tool.started` / `tool.completed` events fire
5. When `run.completed` fires, the message is finalized

## 5. Primer CSS Usage

Primer provides:
- **Layout utilities**: `d-flex`, `flex-column`, `flex-1`, `overflow-auto`
- **Spacing**: `p-3`, `m-2`, `gap-2`
- **Colors**: `color-bg-default`, `color-fg-muted`, semantic tokens
- **Components**: `Box`, `Button`, `ActionList`, `Dialog`, `FormControl`,
  `Flash`, `Label`, `Spinner`, `Truncate`
- **Dark mode**: Built-in via `data-color-mode` attribute

Example — a message bubble:
```html
<div class="Box p-3 mb-2 color-bg-subtle rounded-2">
  <div class="d-flex gap-2 mb-1">
    <span class="Label Label--accent">assistant</span>
    <span class="color-fg-muted text-small">2 min ago</span>
  </div>
  <div class="markdown-body">
    <!-- rendered markdown content -->
  </div>
</div>
```

## 6. State Management

No framework store. Each feature module manages its own state:

```typescript
// state/sessions.ts
type Listener = () => void;

let sessions: Session[] = [];
const listeners = new Set<Listener>();

export function getSessions() { return sessions; }

export function setSessions(next: Session[]) {
  sessions = next;
  listeners.forEach(fn => fn());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

Components subscribe on mount, unsubscribe on unmount. This is ~20 lines per
store, zero dependencies, fully testable.

## 7. API Client

Thin fetch wrapper:

```typescript
// api/client.ts
const BASE = '';  // same-origin

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}
// ...put, del
```

## 8. Socket.IO Client

```typescript
// ws/chat.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connect() {
  socket = io('/chat-run', { transports: ['websocket'] });
  socket.on('message.delta', handleDelta);
  socket.on('tool.started', handleToolStarted);
  socket.on('tool.completed', handleToolCompleted);
  socket.on('run.completed', handleRunCompleted);
  // ... other events
}

export function sendMessage(sessionId: string, content: string, opts: ChatOpts) {
  socket?.emit('chat.send', { sessionId, content, ...opts });
}

export function abort(sessionId: string) {
  socket?.emit('chat.abort', { sessionId });
}
```

## 9. Rendering Pipeline for AI Messages

```
Raw content (string/blocks)
  → markdown-it parse
  → highlight.js for code blocks
  → KaTeX for math ($...$, $$...$$)
  → DOM output into .markdown-body container
```

Primer's `markdown-body` class provides GitHub-style markdown rendering
(typography, tables, code blocks, blockquotes) out of the box.

## 10. Dark Mode

Primer supports dark mode via `data-color-mode="dark"` on `<html>`.
Toggle stored in `localStorage`, applied at page load before first paint
(inline script in `index.html` to avoid flash).
