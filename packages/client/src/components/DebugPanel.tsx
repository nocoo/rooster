import { debugEnabled, debugEvents, clearDebugEvents } from '../state/debug.js'
import type { DebugEvent } from '../state/debug.js'

function DebugEventItem({ entry }: { entry: DebugEvent }) {
  const time = new Date(entry.time).toLocaleTimeString()
  return (
    <details class="debug-event-item">
      <summary>
        <span class="Label Label--small Label--secondary">{entry.event}</span>
        <span class="color-fg-muted f6">{time}</span>
      </summary>
      <pre class="debug-event-payload">{JSON.stringify(entry.payload, null, 2)}</pre>
    </details>
  )
}

export function DebugPanel() {
  if (!debugEnabled.value) return null

  const events = debugEvents.value

  return (
    <div class="debug-panel">
      <div class="debug-panel-header">
        <span class="text-bold f6">Debug Events ({events.length})</span>
        <button type="button" class="btn btn-sm" onClick={clearDebugEvents}>
          Clear
        </button>
      </div>
      <div class="debug-panel-body">
        {events.length === 0 && (
          <p class="color-fg-muted f6 p-2">No events captured yet.</p>
        )}
        {events.map((entry) => (
          <DebugEventItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
