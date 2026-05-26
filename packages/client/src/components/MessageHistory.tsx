import { messages, loading, activeSession } from '../state/sessions.js'
import { streaming, chatError } from '../state/chat.js'
import { ChatInput } from './ChatInput.js'
import { StreamingMessage } from './StreamingMessage.js'
import { ToolTrace } from './ToolTrace.js'
import { AgentStatusBar } from './AgentStatusBar.js'

export function MessageHistory() {
  const msgs = messages.value
  const session = activeSession.value
  const isLoading = loading.value

  if (!session) {
    return (
      <div class="app-chat">
        <div class="chat-welcome">
          <p>Select a session to view history</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div class="app-chat">
        <div class="chat-welcome">
          <span class="AnimatedEllipsis">Loading</span>
        </div>
      </div>
    )
  }

  return (
    <div class="app-chat">
      <div class="chat-messages">
        {msgs.length === 0 && !streaming.value && (
          <p class="color-fg-muted">No messages in this session</p>
        )}
        {msgs.map((msg) => (
          <div
            key={msg.id}
            class={`message-bubble ${msg.role === 'user' ? 'message-bubble--user' : 'message-bubble--assistant'}`}
          >
            <div class="message-meta">
              <span class={`Label Label--small ${msg.role === 'assistant' ? 'Label--accent' : 'Label--secondary'}`}>
                {msg.role}
              </span>
              <span class="color-fg-muted">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-content">{msg.content}</div>
          </div>
        ))}
        {streaming.value && (
          <>
            <AgentStatusBar />
            <ToolTrace />
            <StreamingMessage />
          </>
        )}
        {chatError.value && (
          <div class="message-bubble message-bubble--error">
            <div class="message-meta">
              <span class="Label Label--small Label--danger">error</span>
            </div>
            <div class="message-content">{chatError.value}</div>
          </div>
        )}
      </div>
      <div class="chat-input-area">
        <ChatInput />
      </div>
    </div>
  )
}
