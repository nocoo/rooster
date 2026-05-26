import { messages, loading, activeSession } from '../state/sessions.js'
import { streaming, chatError } from '../state/chat.js'
import { ChatInput } from './ChatInput.js'
import { StreamingMessage } from './StreamingMessage.js'
import { ToolTrace } from './ToolTrace.js'

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
    <div class="d-flex flex-column flex-1 overflow-hidden">
      <div class="overflow-auto flex-1 p-3">
        <h3 class="f4 mb-3">{session.title ?? session.id.slice(0, 8)}</h3>
        {msgs.length === 0 && !streaming.value && (
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
        {streaming.value && (
          <>
            <ToolTrace />
            <StreamingMessage />
          </>
        )}
        {chatError.value && (
          <div class="flash flash-error mb-2">{chatError.value}</div>
        )}
      </div>
      <ChatInput />
    </div>
  )
}
