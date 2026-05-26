import Router from 'preact-router'
import { useEffect } from 'preact/hooks'
import { SessionList } from '../components/SessionList.js'
import { MessageHistory } from '../components/MessageHistory.js'
import { ChatInput } from '../components/ChatInput.js'
import { loadSessions, setActiveSession, activeSessionId } from '../state/sessions.js'
import { initChat } from '../state/chat.js'

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
  if (activeSessionId.value) {
    return (
      <div class="flex-1 d-flex flex-column overflow-hidden">
        <MessageHistory />
      </div>
    )
  }

  return (
    <div class="flex-1 d-flex flex-column overflow-hidden">
      <div class="d-flex align-items-center justify-content-center flex-1 color-fg-muted">
        <p>Start a new conversation</p>
      </div>
      <ChatInput />
    </div>
  )
}

export function App({ url }: { url?: string }) {
  useEffect(() => {
    initChat()
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
        <Router {...(url ? { url } : {})}>
          <HomePage path="/" />
          <ChatPage path="/session/:id" />
        </Router>
      </main>
    </div>
  )
}
