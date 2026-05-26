import { route } from 'preact-router'
import { sessions, activeSessionId, removeSession } from '../state/sessions.js'

function startNewChat() {
  activeSessionId.value = null
  route('/')
}

export function SessionList() {
  const items = sessions.value
  const activeId = activeSessionId.value

  return (
    <div class="p-3">
      <div class="d-flex flex-items-center flex-justify-between mb-3">
        <span class="text-bold f5">Sessions</span>
        <button class="btn btn-sm" type="button" onClick={startNewChat}>
          New Chat
        </button>
      </div>
      {items.length === 0 && (
        <p class="color-fg-muted f6">No sessions yet</p>
      )}
      {items.map((session) => (
        <div
          key={session.id}
          class={`session-item${session.id === activeId ? ' session-item--active' : ''}`}
          onClick={() => { route(`/session/${session.id}`) }}
        >
          <span class="session-item-label">
            {session.title ?? `Chat ${session.id.slice(0, 8)}`}
          </span>
          <span class="session-item-time">{formatDate(session.last_active)}</span>
          <button
            class="session-item-delete"
            type="button"
            aria-label="Delete session"
            onClick={(e) => {
              e.stopPropagation()
              void removeSession(session.id)
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${String(diffMins)}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${String(diffHours)}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${String(diffDays)}d ago`
  return date.toLocaleDateString()
}
