import { useRef } from 'preact/hooks'
import { streaming, aborting, send, abort } from '../state/chat.js'
import { selectedModel, selectedProfile } from '../state/settings.js'

export function ChatInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: Event) {
    e.preventDefault()
    const el = inputRef.current
    if (!el) return
    const text = el.value.trim()
    if (!text) return
    const opts: { model?: string; profile?: string } = {}
    if (selectedModel.value) opts.model = selectedModel.value
    if (selectedProfile.value) opts.profile = selectedProfile.value
    send(text, Object.keys(opts).length > 0 ? opts : undefined)
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
    <form onSubmit={handleSubmit}>
      <div class="d-flex gap-2">
        <textarea
          ref={inputRef}
          class="form-control flex-1"
          placeholder="Send a message…"
          rows={3}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
          style={{ resize: 'none' }}
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
