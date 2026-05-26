import { messages, loading, activeSession } from '../state/sessions.js'

export function MessageHistory() {
  const msgs = messages.value
  const session = activeSession.value
  const isLoading = loading.value

  if (!session) {
    return (
      <div class="d-flex align-items-center justify-content-center flex-1 color-fg-muted">
        <p>Select a session to view history</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div class="d-flex align-items-center justify-content-center flex-1">
        <span class="AnimatedEllipsis">Loading</span>
      </div>
    )
  }

  return (
    <div class="overflow-auto flex-1 p-3">
      <h3 class="f4 mb-3">{session.title ?? session.id.slice(0, 8)}</h3>
      {msgs.length === 0 && (
        <p class="color-fg-muted">No messages in this session</p>
      )}
      {msgs.map((msg) => (
        <div
          key={msg.id}
          class={`Box p-3 mb-2 rounded-2 ${msg.role === 'user' ? 'color-bg-accent' : 'color-bg-subtle'}`}
        >
          <div class="d-flex gap-2 mb-1">
            <span class={`Label ${msg.role === 'assistant' ? 'Label--accent' : 'Label--secondary'}`}>
              {msg.role}
            </span>
            <span class="color-fg-muted f6">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="markdown-body">{msg.content}</div>
        </div>
      ))}
    </div>
  )
}
