import { useRef } from 'preact/hooks'
import { isStreamingHere, aborting, send, abort } from '../state/chat.js'
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
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- keyCode 229 is the only reliable IME guard in some browsers
    const isComposing = e.isComposing || e.keyCode === 229 || e.which === 229
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isStreaming = isStreamingHere.value
  const isAborting = aborting.value

  return (
    <form onSubmit={handleSubmit}>
      <div class="d-flex gap-3">
        <textarea
          ref={inputRef}
          class="form-control flex-1"
          placeholder="Send a message…"
          rows={1}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          aria-label="Message input"
          style={{ resize: 'none', borderRadius: '8px', maxHeight: '120px', overflow: 'auto' }}
        />
        {isStreaming ? (
          <button
            type="button"
            class="btn btn-danger btn-sm"
            onClick={() => { abort() }}
            disabled={isAborting}
            style={{ whiteSpace: 'nowrap' }}
          >
            {isAborting ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button type="submit" class="btn btn-sm" style={{ whiteSpace: 'nowrap' }}>
            Send
          </button>
        )}
      </div>
    </form>
  )
}
