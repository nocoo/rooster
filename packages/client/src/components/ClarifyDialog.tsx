import { useSignal, useComputed } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { pendingClarify, respondClarify } from '../state/chat.js'

export function ClarifyDialog() {
  const clarify = pendingClarify.value
  const clarifyInput = useSignal('')
  const clarifyId = useComputed(() => pendingClarify.value?.clarify_id ?? null)

  useEffect(() => {
    clarifyInput.value = ''
  }, [clarifyId.value])

  if (!clarify) return null

  const handleSubmit = () => {
    const value = clarifyInput.value.trim()
    if (!value) return
    respondClarify(value)
    clarifyInput.value = ''
  }

  return (
    <div class="clarify-dialog Box color-shadow-medium">
      <div class="Box-header">
        <h3 class="Box-title f5">Clarification Needed</h3>
      </div>
      <div class="Box-body">
        <p class="clarify-question f6">{clarify.question}</p>
        {clarify.choices && clarify.choices.length > 0 && (
          <div class="clarify-choices mt-2">
            {clarify.choices.map((choice) => (
              <button
                key={choice}
                class="btn btn-sm btn-outline mr-2 mb-1"
                disabled={clarify.responding}
                onClick={() => { respondClarify(choice) }}
              >
                {choice}
              </button>
            ))}
          </div>
        )}
        <div class="clarify-input mt-2 d-flex">
          <input
            type="text"
            class="form-control input-sm flex-auto"
            placeholder="Type a response…"
            value={clarifyInput.value}
            disabled={clarify.responding}
            onInput={(e) => { clarifyInput.value = (e.target as HTMLInputElement).value }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          />
          <button
            class="btn btn-sm btn-primary ml-2"
            disabled={clarify.responding || !clarifyInput.value.trim()}
            onClick={handleSubmit}
          >
            {clarify.responding ? '…' : 'Send'}
          </button>
        </div>
        {clarify.timeout_ms != null && (
          <p class="f6 color-fg-muted mt-2">Timeout: {Math.round(clarify.timeout_ms / 1000)}s</p>
        )}
      </div>
    </div>
  )
}
