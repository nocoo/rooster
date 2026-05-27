import { activeSession, removeSession } from '../state/sessions.js'
import { getExportUrl } from '../api/sessions.js'

function handleExport(sessionId: string, format: 'json' | 'markdown') {
  const url = getExportUrl(sessionId, format)
  const a = document.createElement('a')
  a.href = url
  a.download = `session-${sessionId.slice(0, 8)}.${format === 'json' ? 'json' : 'md'}`
  a.click()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function SessionHeader() {
  const session = activeSession.value
  if (!session) return null

  return (
    <div class="session-header">
      <div class="session-header-left">
        <span class="session-header-title">{session.title ?? `Chat ${session.id.slice(0, 8)}`}</span>
        <span class="session-header-time">{formatDate(session.last_active)}</span>
      </div>
      <div class="session-header-actions">
        <button
          type="button"
          class="btn-octicon"
          aria-label="Export JSON"
          title="Export JSON"
          onClick={() => { handleExport(session.id, 'json') }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14H2.75Z" />
            <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
          </svg>
        </button>
        <button
          type="button"
          class="btn-octicon"
          aria-label="Export Markdown"
          title="Export Markdown"
          onClick={() => { handleExport(session.id, 'markdown') }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14.85 3c.63 0 1.15.52 1.14 1.15v7.7c0 .63-.51 1.15-1.15 1.15H1.15C.52 13 0 12.48 0 11.84V4.15C0 3.52.52 3 1.15 3ZM9 11V5H7l-2 2-2-2H1v6h2V8l2 2 2-2v3Zm2.99.5L14.5 8H13V5h-2v3H9.5Z" />
          </svg>
        </button>
        <button
          type="button"
          class="btn-octicon"
          aria-label="Delete session"
          title="Delete session"
          onClick={() => { void removeSession(session.id) }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
