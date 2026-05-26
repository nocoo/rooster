import { useRef, useEffect } from 'preact/hooks'
import { useSignal } from '@preact/signals'
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
import { isNearBottom, scrollToBottom } from '../lib/auto-scroll.js'
import type { AttachmentRef } from '../types.js'

function AttachmentList({ attachments }: { attachments: AttachmentRef[] }) {
  return (
    <div class="message-attachments">
      {attachments.map((a) => (
        <span key={a.id} class="message-attachment-chip">
          <span class="message-attachment-name">{a.original_name}</span>
        </span>
      ))}
    </div>
  )
}

export function MessageHistory() {
  const msgs = messages.value
  const session = activeSession.value
  const isLoading = loading.value
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const following = useSignal(true)

  useEffect(() => {
    following.value = true
    if (containerRef.current) {
      scrollToBottom(containerRef.current)
    }
  }, [session?.id])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (following.value && containerRef.current) {
        scrollToBottom(containerRef.current)
      }
    })
    observer.observe(content)
    return () => { observer.disconnect() }
  }, [session?.id, isLoading])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    following.value = isNearBottom(el)
  }

  function handleJumpToBottom() {
    const el = containerRef.current
    if (!el) return
    scrollToBottom(el)
    following.value = true
  }

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
      <div class="chat-messages" ref={containerRef} onScroll={handleScroll}>
        <div ref={contentRef}>
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
                <>
                  <div class="message-content">{msg.content}</div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <AttachmentList attachments={msg.attachments} />
                  )}
                </>
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
      </div>
      {!following.value && (
        <button
          type="button"
          class="jump-to-bottom"
          onClick={handleJumpToBottom}
          aria-label="Jump to bottom"
        >
          ↓
        </button>
      )}
      <div class="chat-input-area">
        <ChatInput />
      </div>
    </div>
  )
}
