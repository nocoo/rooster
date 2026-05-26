import { streamOutput, reasoningText, reasoningDone } from '../state/chat.js'
import { Markdown } from './Markdown.js'
import { ReasoningBlock } from './ReasoningBlock.js'

export function StreamingMessage() {
  const output = streamOutput.value
  const reasoning = reasoningText.value
  const done = reasoningDone.value

  if (!output && !reasoning) return null

  return (
    <div class="streaming-box">
      <div class="streaming-header">
        <span class="Label Label--secondary Label--small">Agent</span>
        <span class="AnimatedEllipsis color-fg-muted f6">streaming</span>
      </div>
      <ReasoningBlock reasoning={reasoning} done={done} streaming={true} />
      {output && <Markdown content={output} />}
    </div>
  )
}
