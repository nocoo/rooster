import { route } from 'preact-router'
import {
  sessions,
  activeSessionId,
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  isSearching,
  performSearch,
  clearSearch,
} from '../state/sessions.js'

function startNewChat() {
  activeSessionId.value = null
  route('/')
}

function handleSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  void performSearch(value)
}

export function SessionList() {
  const items = sessions.value
  const activeId = activeSessionId.value
  const searching = isSearching.value
  const results = searchResults.value
  const sLoading = searchLoading.value
  const sError = searchError.value

  return (
    <div class="p-3">
      <div class="d-flex flex-items-center flex-justify-between mb-3">
        <span class="text-bold f5">Sessions</span>
        <button class="btn btn-sm" type="button" onClick={startNewChat}>
          New Chat
        </button>
      </div>
      <input
        class="form-control input-sm mb-3"
        type="text"
        placeholder="Search sessions…"
        value={searchQuery.value}
        onInput={handleSearchInput}
        aria-label="Search sessions"
        style={{ width: '100%' }}
      />
      {searching && sLoading && (
        <p class="color-fg-muted f6">Searching…</p>
      )}
      {searching && sError && (
        <p class="color-fg-danger f6">{sError}</p>
      )}
      {searching && !sLoading && !sError && results.length === 0 && (
        <p class="color-fg-muted f6">No results found</p>
      )}
      {searching && !sLoading && results.length > 0 && (
        <div>
          <div class="d-flex flex-items-center flex-justify-between mb-2">
            <span class="color-fg-muted f6">{String(results.length)} results</span>
            <button class="btn-link f6" type="button" onClick={clearSearch}>Clear</button>
          </div>
          {results.map(({ session, snippet }) => (
            <div
              key={session.id}
              class={`session-item${session.id === activeId ? ' session-item--active' : ''}`}
              onClick={() => { route(`/session/${session.id}`) }}
            >
              <span class="session-item-label">
                {session.title ?? `Chat ${session.id.slice(0, 8)}`}
              </span>
              {snippet && (
                <span class="session-item-snippet">{snippet}</span>
              )}
              <span class="session-item-time">{formatDate(session.last_active)}</span>
            </div>
          ))}
        </div>
      )}
      {!searching && items.length === 0 && (
        <p class="color-fg-muted f6">No sessions yet</p>
      )}
      {!searching && items.map((session) => (
        <div
          key={session.id}
          class={`session-item${session.id === activeId ? ' session-item--active' : ''}`}
          onClick={() => { route(`/session/${session.id}`) }}
        >
          <span class="session-item-label">
            {session.title ?? `Chat ${session.id.slice(0, 8)}`}
          </span>
          <span class="session-item-time">{formatDate(session.last_active)}</span>
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
