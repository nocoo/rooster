import { messages, loading, activeSession } from '../state/sessions.js'
import { isStreamingHere, chatError, pendingApproval, pendingClarify } from '../state/chat.js'
import { ChatInput } from './ChatInput.js'
import { StreamingMessage } from './StreamingMessage.js'
import { ToolTrace } from './ToolTrace.js'
import { AgentStatusBar } from './AgentStatusBar.js'
import { ApprovalDialog } from './ApprovalDialog.js'
import { ClarifyDialog } from './ClarifyDialog.js'
import { Markdown } from './Markdown.js'
import { ReasoningBlock } from './ReasoningBlock.js'

export function MessageHistory() {
  const msgs = messages.value
  const session = activeSession.value
  const isLoading = loading.value

  if (!session) {
    return (
      <div class="app-chat">
        <div class="chat-welcome">
          <p class="f4 color-fg-muted">Select a session to view history</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div class="app-chat">
        <div class="chat-welcome">
          <span class="AnimatedEllipsis color-fg-muted">Loading</span>
        </div>
      </div>
    )
  }

  return (
    <div class="app-chat">
      <div class="chat-messages">
        {msgs.length === 0 && !isStreamingHere.value && (
          <p class="color-fg-muted f5">No messages in this session</p>
        )}
        {msgs.map((msg) => (
          <div
            key={msg.id}
            class={`message-bubble ${msg.role === 'user' ? 'message-bubble--user' : 'message-bubble--assistant'}`}
          >
            <div class="message-meta">
              <span class={`Label Label--small ${msg.role === 'assistant' ? 'Label--secondary' : 'Label--outline'}`}>
                {msg.role === 'assistant' ? 'Agent' : 'Human'}
              </span>
              <span class="color-fg-muted">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            {msg.role === 'assistant' ? (
              <>
                {msg.reasoning && (
                  <ReasoningBlock reasoning={msg.reasoning} done={true} />
                )}
                <Markdown content={msg.content} />
              </>
            ) : (
              <div class="message-content">{msg.content}</div>
            )}
          </div>
        ))}
        {isStreamingHere.value && (
          <>
            <AgentStatusBar />
            <ToolTrace />
            <StreamingMessage />
          </>
        )}
        {pendingApproval.value && <ApprovalDialog />}
        {pendingClarify.value && <ClarifyDialog />}
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
