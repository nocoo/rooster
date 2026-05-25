# 03 — Frontend Design

## 1. Framework Choice: Preact

**Decision**: Use Preact (not vanilla TS, not Vue, not React).

**Why not vanilla TS?**
Chat streaming creates complex DOM lifecycle:
- Message list that grows incrementally as `message.delta` events fire
- Tool traces that appear/disappear with `tool.started`/`tool.completed`
- Reasoning blocks that expand/collapse
- Approval dialogs that pop up mid-stream
- Session list that updates when new sessions are created

Managing this with raw `document.createElement` means re-implementing a
virtual DOM or maintaining brittle imperative update paths. Real apps of this
complexity need a component model with lifecycle management.

**Why Preact over React/Vue?**
- **3KB** gzipped (vs React 40KB, Vue 33KB)
- Full JSX + hooks API (familiar to any React developer)
- `@preact/signals` for fine-grained reactivity (optional, 1KB)
- Compatible with Vite out of the box
- No ecosystem lock-in (Primer CSS is framework-agnostic)

**Why not Vue (same as source)?**
User specified "完全复刻重写前端" — a rewrite, not a port. Vue + Naive UI is
what we're replacing. Preact + Primer CSS gives a completely different stack
while staying lightweight.

## 2. Technology Stack

| Concern | Choice | Size |
|---------|--------|------|
| Rendering | Preact 10.x | 3KB |
| Bundler | Vite 6.x | dev-only |
| Styling | @primer/css 21.x | ~50KB (treeshakeable) |
| Icons | @primer/octicons (SVG, framework-agnostic) | tree-shaken |
| Routing | preact-router | 3KB |
| State | @preact/signals | 1KB |
| Markdown | markdown-it + highlight.js + KaTeX | ~150KB (lazy-loaded) |
| Terminal | @xterm/xterm | ~200KB (lazy-loaded, Phase 3 only) |
| Real-time | socket.io-client | ~30KB |
| HTTP | Native fetch (wrapper) | 0KB |

Total initial bundle (Phase 1): ~90KB gzipped estimated.

## 3. Page Structure (Phase 1 MVP only)

```
/                         → Chat (default session or new)
/session/:id              → Chat with specific session
/history                  → Session history list
```

Phase 2+ pages added incrementally (see doc 05).

## 4. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header: [≡] Rooster        [Profile ▾] [Model ▾] [◑]   │
├────────────────────┬────────────────────────────────────┤
│ Session List       │  Chat Area                         │
│                    │                                     │
│ [+ New]            │  ┌────────────────────────────┐    │
│ ○ Session 1        │  │ Message bubble (assistant)  │    │
│ ● Session 2 (act.) │  │ Message bubble (user)       │    │
│ ○ Session 3        │  │ Streaming message...        │    │
│                    │  │   └ [Tool trace]            │    │
│                    │  │   └ [Reasoning]             │    │
│                    │  └────────────────────────────┘    │
│                    │                                     │
│                    │  ┌────────────────────────────┐    │
│                    │  │ [Input]            [Send ▶] │    │
│                    │  └────────────────────────────┘    │
└────────────────────┴────────────────────────────────────┘
```

- Left panel: session list (collapsible on mobile)
- Header: profile/model selectors, dark mode toggle
- Main: chat messages + input

## 5. Core Components (Phase 1)

| Component | File | Responsibility |
|-----------|------|---------------|
| `App` | `pages/App.tsx` | Layout shell, router |
| `ChatPage` | `pages/ChatPage.tsx` | Session lifecycle, connect Socket.IO |
| `MessageList` | `components/MessageList.tsx` | Scrollable container, auto-scroll |
| `MessageBubble` | `components/MessageBubble.tsx` | Single message: markdown + code |
| `StreamingMessage` | `components/StreamingMessage.tsx` | Live-updating message during stream |
| `ChatInput` | `components/ChatInput.tsx` | Textarea + send/abort buttons |
| `SessionList` | `components/SessionList.tsx` | Left panel session navigator |
| `Header` | `components/Header.tsx` | Profile/model selectors |
| `ToolTrace` | `components/ToolTrace.tsx` | Collapsible tool call display |

## 6. State Management

Using `@preact/signals` for reactive state:

```typescript
// state/sessions.ts
import { signal, computed } from '@preact/signals'
import type { Session } from '../types'

export const sessions = signal<Session[]>([])
export const activeSessionId = signal<string | null>(null)

export const activeSession = computed(() =>
  sessions.value.find(s => s.id === activeSessionId.value) ?? null
)

// Actions
export async function loadSessions() {
  sessions.value = await api.get('/api/hermes/sessions')
}

export function setActiveSession(id: string) {
  activeSessionId.value = id
}
```

Components automatically re-render when signals they read change. No
subscriptions, no providers, no boilerplate.

## 7. Socket.IO Client

```typescript
// ws/chat.ts
import { io, Socket } from 'socket.io-client'
import { signal } from '@preact/signals'

export const connected = signal(false)
export const streaming = signal(false)

let socket: Socket | null = null

export function connect() {
  socket = io('/chat-run', { transports: ['websocket'] })
  socket.on('connect', () => { connected.value = true })
  socket.on('disconnect', () => { connected.value = false })
  
  // Chat events (field names match server: snake_case for IDs, camelCase for token counters)
  socket.on('run.started', onRunStarted)       // { run_id, queue_length }
  socket.on('message.delta', onMessageDelta)   // { run_id, delta, output }
  socket.on('tool.started', onToolStarted)     // { run_id, tool_call_id, tool, name, arguments, preview }
  socket.on('tool.completed', onToolCompleted) // { run_id, tool_call_id, tool, name, output, duration, error }
  socket.on('run.completed', onRunCompleted)   // { run_id, output, result, error, inputTokens, outputTokens, contextTokens }
  socket.on('run.failed', onRunFailed)         // { error, inputTokens?, outputTokens? }
  socket.on('abort.completed', onAbortCompleted)
  socket.on('approval.requested', onApprovalRequested) // { run_id, approval_id, command, description, choices }
  socket.on('reasoning.delta', onReasoningDelta) // { run_id, text }
}

export function sendMessage(sessionId: string, input: string, opts?: {
  model?: string
  profile?: string
}) {
  socket?.emit('run', { sessionId, input, ...opts })
}

export function abort(sessionId: string) {
  socket?.emit('abort', { sessionId })
}
```

## 8. API Client

```typescript
// api/client.ts
class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
```

## 9. Markdown Rendering

```typescript
// lib/markdown.ts
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang }).value
    }
    return ''
  }
})

export function renderMarkdown(content: string): string {
  return md.render(content)
}
```

Primer's `.markdown-body` class applies GitHub-style typography.
KaTeX loaded lazily only when `$` math delimiters detected.

## 10. Primer CSS Usage

Primer provides utility classes + semantic tokens:

```html
<!-- Layout -->
<div class="d-flex flex-column height-full">
  <header class="Header">...</header>
  <main class="d-flex flex-1 overflow-hidden">
    <nav class="SideNav" style="width: 260px">...</nav>
    <section class="flex-1 overflow-auto p-3">...</section>
  </main>
</div>

<!-- Message bubble -->
<div class="Box color-bg-subtle p-3 mb-2 rounded-2">
  <div class="d-flex gap-2 mb-1">
    <span class="Label Label--accent">assistant</span>
    <span class="color-fg-muted f6">2 min ago</span>
  </div>
  <div class="markdown-body">...</div>
</div>
```

## 11. Dark Mode

Primer supports `data-color-mode="dark"` on `<html>`. Applied at page load
via inline script (no flash):

```html
<script>
  document.documentElement.dataset.colorMode =
    localStorage.getItem('color-mode') || 'auto'
</script>
```

## 12. Testing Strategy

| Layer | Tool | Approach |
|-------|------|----------|
| Components | Preact Testing Library + vitest | Render, simulate events, assert DOM |
| State (signals) | vitest | Direct signal manipulation + assertion |
| API client | vitest + msw | Mock fetch responses |
| Socket.IO client | vitest + mock socket | Emit events, assert state changes |
| Markdown | vitest | Input → output snapshot tests |
