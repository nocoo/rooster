import { useRef, useEffect } from 'preact/hooks'
import { isStreamingHere, aborting, anySessionWorking, send, abort } from '../state/chat.js'
import { selectedModel, selectedProfile, selectedProvider } from '../state/settings.js'
import { pendingAttachments, readyAttachments, hasUploading, addFiles, removeAttachment, clearAttachments } from '../state/attachments.js'
import { activeSessionId } from '../state/sessions.js'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.isComposing && isStreamingHere.value && !aborting.value) {
        e.preventDefault()
        abort()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => { document.removeEventListener('keydown', handleGlobalKeyDown) }
  }, [])

  function handleSubmit(e: Event) {
    e.preventDefault()
    if (anySessionWorking.value || hasUploading.value) return
    const el = inputRef.current
    if (!el) return
    const text = el.value.trim()
    if (!text) return
    const opts: { model?: string; profile?: string; provider?: string; attachments?: Array<{ id: string; original_name: string; mime_type: string; size: number }> } = {}
    if (selectedModel.value) opts.model = selectedModel.value
    if (selectedProfile.value) opts.profile = selectedProfile.value
    if (selectedProvider.value) opts.provider = selectedProvider.value

    const ready = readyAttachments.value
    if (ready.length > 0) {
      opts.attachments = ready
        .filter((a): a is typeof a & { serverId: string } => typeof a.serverId === 'string')
        .map((a) => ({
          id: a.serverId,
          original_name: a.original_name,
          mime_type: a.mime_type,
          size: a.size,
        }))
    }

    send(text, Object.keys(opts).length > 0 ? opts : undefined)
    el.value = ''
    clearAttachments()
  }

  function handleKeyDown(e: KeyboardEvent) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- keyCode 229 is the only reliable IME guard in some browsers
    const isComposing = e.isComposing || e.keyCode === 229 || e.which === 229
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      addFiles(input.files, activeSessionId.value ?? undefined)
      input.value = ''
    }
  }

  const isStreaming = isStreamingHere.value
  const isAborting = aborting.value
  const anyWorking = anySessionWorking.value
  const attachments = pendingAttachments.value
  const uploading = hasUploading.value
  const sendDisabled = anyWorking || uploading

  return (
    <form onSubmit={handleSubmit}>
      {attachments.length > 0 && (
        <div class="attachment-chips">
          {attachments.map((a) => (
            <span key={a.localId} class={`attachment-chip attachment-chip--${a.status}`}>
              <span class="attachment-chip-name">{a.original_name}</span>
              <span class="attachment-chip-size">{formatSize(a.size)}</span>
              {a.status === 'error' && <span class="attachment-chip-error">{a.error}</span>}
              <button
                type="button"
                class="attachment-chip-remove"
                onClick={() => { removeAttachment(a.localId) }}
                aria-label={`Remove ${a.original_name}`}
              >&times;</button>
            </span>
          ))}
        </div>
      )}
      <div class="d-flex gap-3">
        <button
          type="button"
          class="btn-octicon"
          onClick={() => { fileRef.current?.click() }}
          disabled={anyWorking}
          aria-label="Attach file"
          title="Attach file"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.5 6.5a.5.5 0 0 1-.5-.5V1.5a2 2 0 0 0-4 0V6a3.5 3.5 0 1 0 7 0V3a.5.5 0 0 1 1 0v3a4.5 4.5 0 1 1-9 0V1.5a3 3 0 0 1 6 0V6a.5.5 0 0 1-.5.5z" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept="image/*,.pdf,.txt,.md,.csv,.json"
        />
        <textarea
          ref={inputRef}
          class="form-control flex-1"
          placeholder="Send a message…"
          rows={1}
          disabled={anyWorking}
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
          <button type="submit" class="btn btn-sm" disabled={sendDisabled} style={{ whiteSpace: 'nowrap' }}>
            Send
          </button>
        )}
      </div>
    </form>
  )
}
