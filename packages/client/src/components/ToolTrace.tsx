import { toolEvents } from '../state/chat.js'
import type { ToolEvent } from '../ws/chat.js'

function ToolItem({ event }: { event: ToolEvent }) {
  const isCompleted = event.status === 'completed'
  return (
    <details class="Box mb-1 rounded-1">
      <summary class="d-flex gap-2 p-2 f6">
        <span class={`Label ${isCompleted ? 'Label--success' : 'Label--attention'}`}>
          {isCompleted ? 'done' : 'running'}
        </span>
        <span class="text-bold">{event.name}</span>
        {event.duration != null && (
          <span class="color-fg-muted">{event.duration}ms</span>
        )}
      </summary>
      <div class="p-2 border-top f6">
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
    <div class="mb-2">
      {events.map((evt) => (
        <ToolItem key={evt.tool_call_id} event={evt} />
      ))}
    </div>
  )
}
