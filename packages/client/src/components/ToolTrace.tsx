import { toolEvents } from '../state/chat.js'
import type { ToolEvent } from '../ws/chat.js'

function ToolItem({ event }: { event: ToolEvent }) {
  const isCompleted = event.status === 'completed'
  return (
    <details class="tool-item">
      <summary>
        <span class={`Label Label--small ${isCompleted ? 'Label--success' : 'Label--attention'}`}>
          {isCompleted ? 'done' : 'running'}
        </span>
        <span class="text-bold">{event.name}</span>
        {event.duration != null && (
          <span class="color-fg-muted">{event.duration}ms</span>
        )}
      </summary>
      <div class="tool-item-body">
        {event.arguments && (
          <pre class="color-fg-muted mb-1" style={{ whiteSpace: 'pre-wrap' }}>{event.arguments}</pre>
        )}
        {event.output && (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{event.output}</pre>
        )}
        {event.error && (
          <pre class="color-fg-danger" style={{ whiteSpace: 'pre-wrap' }}>{event.error}</pre>
        )}
      </div>
    </details>
  )
}

export function ToolTrace() {
  const events = toolEvents.value
  if (events.length === 0) return null

  return (
    <div class="mb-3">
      {events.map((evt) => (
        <ToolItem key={evt.tool_call_id} event={evt} />
      ))}
    </div>
  )
}
