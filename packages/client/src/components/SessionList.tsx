import { route } from 'preact-router'
import { sessions, activeSessionId, removeSession } from '../state/sessions.js'

export function SessionList() {
  const items = sessions.value
  const activeId = activeSessionId.value

  return (
    <div class="p-2">
      <div class="d-flex flex-items-center flex-justify-between mb-2 px-2">
        <h3 class="f5 text-bold">Sessions</h3>
      </div>
      {items.length === 0 && (
        <p class="color-fg-muted f6 px-2">No sessions yet</p>
      )}
      <ul class="ActionList">
        {items.map((session) => (
          <li
            key={session.id}
            class={`ActionList-item${session.id === activeId ? ' ActionList-item--navActive' : ''}`}
          >
            <button
              class="ActionList-content"
              type="button"
              onClick={() => { route(`/session/${session.id}`) }}
            >
              <span class="ActionList-item-label text-truncate">
                {session.title ?? session.id.slice(0, 8)}
              </span>
              <span class="ActionList-item-description color-fg-muted f6">
                {formatDate(session.last_active)}
              </span>
            </button>
            <button
              class="ActionList-item-action btn-octicon"
              type="button"
              aria-label="Delete session"
              onClick={(e) => {
                e.stopPropagation()
                void removeSession(session.id)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
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
