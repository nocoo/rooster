import { useRef } from 'preact/hooks'
import { streaming, aborting, send, abort } from '../state/chat.js'

export function ChatInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: Event) {
    e.preventDefault()
    const el = inputRef.current
    if (!el) return
    const text = el.value.trim()
    if (!text) return
    send(text)
    el.value = ''
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isStreaming = streaming.value
  const isAborting = aborting.value

  return (
    <form class="border-top p-3" onSubmit={handleSubmit}>
      <div class="d-flex gap-2">
        <textarea
          ref={inputRef}
          class="form-control flex-1"
          placeholder="Send a message…"
          rows={2}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
        />
        {isStreaming ? (
          <button
            type="button"
            class="btn btn-danger"
            onClick={() => { abort() }}
            disabled={isAborting}
          >
            {isAborting ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button type="submit" class="btn btn-primary">
            Send
          </button>
        )}
      </div>
    </form>
  )
}
