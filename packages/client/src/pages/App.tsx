import Router from 'preact-router'
import { useEffect } from 'preact/hooks'
import { SessionList } from '../components/SessionList.js'
import { MessageHistory } from '../components/MessageHistory.js'
import { loadSessions, setActiveSession } from '../state/sessions.js'

function ChatPage({ id }: { path: string; id?: string }) {
  useEffect(() => {
    if (id) setActiveSession(id)
  }, [id])

  return (
    <div class="flex-1 d-flex flex-column overflow-hidden">
      <MessageHistory />
    </div>
  )
}

function HomePage(_props: { path: string }) {
  return (
    <div class="flex-1 d-flex align-items-center justify-content-center color-fg-muted">
      <p>Select a session or start a new one</p>
    </div>
  )
}

export function App() {
  useEffect(() => {
    void loadSessions()
  }, [])

  return (
    <div class="d-flex flex-column height-full">
      <header class="Header">
        <div class="Header-item">
          <a class="Header-link f4 text-bold" href="/">Rooster</a>
        </div>
      </header>
      <main class="d-flex flex-1 overflow-hidden">
        <nav class="border-right" style={{ width: '260px', overflowY: 'auto' }}>
          <SessionList />
        </nav>
        <Router>
          <HomePage path="/" />
          <ChatPage path="/session/:id" />
        </Router>
      </main>
    </div>
  )
}
