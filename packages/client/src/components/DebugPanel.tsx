import { signal } from '@preact/signals'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { debugEnabled, debugEvents, clearDebugEvents } from '../state/debug.js'
import { activeSessionId } from '../state/sessions.js'
import type { DebugEvent } from '../state/debug.js'

hljs.registerLanguage('json', json)

const showAll = signal(false)

const EVENT_ICONS: Record<string, string> = {
  'run.started': '\u{1F680}',
  'run.completed': '\u{2705}',
  'run.failed': '\u{274C}',
  'message.delta': '\u{1F4AC}',
  'tool.started': '\u{1F527}',
  'tool.completed': '\u{1F527}',
  'reasoning.delta': '\u{1F9E0}',
  'thinking.delta': '\u{1F9E0}',
  'reasoning.available': '\u{1F9E0}',
  'agent.event': '\u{1F916}',
  'abort.completed': '\u{1F6D1}',
  'resumed': '\u{1F504}',
}

function getEventIcon(event: string): string {
  return EVENT_ICONS[event] ?? '\u{1F4E1}'
}

function highlightJson(payload: unknown): string {
  const raw = JSON.stringify(payload, null, 2)
  return hljs.highlight(raw, { language: 'json' }).value
}

function getSessionId(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'session_id' in payload) {
    const sid = (payload as Record<string, unknown>)['session_id']
    return typeof sid === 'string' ? sid : undefined
  }
  return undefined
}

function DebugEventItem({ entry }: { entry: DebugEvent }) {
  const time = new Date(entry.time).toLocaleTimeString()
  const html = highlightJson(entry.payload)
  return (
    <details class="debug-event-item">
      <summary>
        <span class="debug-event-icon">{getEventIcon(entry.event)}</span>
        <span class="Label Label--small Label--secondary">{entry.event}</span>
        <span class="debug-event-time color-fg-muted f6">{time}</span>
      </summary>
      <pre class="debug-event-payload" dangerouslySetInnerHTML={{ __html: html }} />
    </details>
  )
}

export function DebugPanel() {
  if (!debugEnabled.value) return null

  const allEvents = debugEvents.value
  const sessionId = activeSessionId.value
  const filtered = showAll.value
    ? allEvents
    : allEvents.filter((e) => {
        const sid = getSessionId(e.payload)
        return !sid || sid === sessionId
      })

  return (
    <div class="debug-panel">
      <div class="debug-panel-header">
        <span class="text-bold f6">Debug ({filtered.length})</span>
        <div class="d-flex gap-1">
          <button
            type="button"
            class={`btn btn-sm${showAll.value ? '' : ' btn-outline'}`}
            onClick={() => { showAll.value = !showAll.value }}
          >
            {showAll.value ? 'All' : 'Session'}
          </button>
          <button type="button" class="btn btn-sm" onClick={clearDebugEvents}>
            Clear
          </button>
        </div>
      </div>
      <div class="debug-panel-body">
        {filtered.length === 0 && (
          <p class="color-fg-muted f6 p-2">No events captured yet.</p>
        )}
        {filtered.map((entry) => (
          <DebugEventItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
