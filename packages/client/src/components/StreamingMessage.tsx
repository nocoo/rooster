import { streamOutput, reasoningText } from '../state/chat.js'

export function StreamingMessage() {
  const output = streamOutput.value
  const reasoning = reasoningText.value

  if (!output && !reasoning) return null

  return (
    <div class="Box p-3 mb-2 rounded-2 color-bg-subtle">
      <div class="d-flex gap-2 mb-1">
        <span class="Label Label--accent">assistant</span>
        <span class="AnimatedEllipsis color-fg-muted f6">streaming</span>
      </div>
      {reasoning && (
        <details class="mb-2">
          <summary class="f6 color-fg-muted">Reasoning</summary>
          <pre class="f6 color-fg-muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{reasoning}</pre>
        </details>
      )}
      <div class="markdown-body">{output}</div>
    </div>
  )
}
