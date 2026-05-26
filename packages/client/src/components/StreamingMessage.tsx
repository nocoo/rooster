import { streamOutput, reasoningText } from '../state/chat.js'

export function StreamingMessage() {
  const output = streamOutput.value
  const reasoning = reasoningText.value

  if (!output && !reasoning) return null

  return (
    <div class="streaming-box">
      <div class="streaming-header">
        <span class="Label Label--secondary Label--small">assistant</span>
        <span class="AnimatedEllipsis color-fg-muted f6">streaming</span>
      </div>
      {reasoning && (
        <details class="streaming-reasoning">
          <summary>Reasoning</summary>
          <pre>{reasoning}</pre>
        </details>
      )}
      {output && <div class="message-content">{output}</div>}
    </div>
  )
}
