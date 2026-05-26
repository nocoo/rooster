import Router from 'preact-router'
import { useEffect } from 'preact/hooks'
import { SessionList } from '../components/SessionList.js'
import { MessageHistory } from '../components/MessageHistory.js'
import { ChatInput } from '../components/ChatInput.js'
import { HeaderSettings } from '../components/HeaderSettings.js'
import { loadSessions, setActiveSession, activeSessionId } from '../state/sessions.js'
import { initChat } from '../state/chat.js'
import { loadSettings } from '../state/settings.js'

function ChatPage({ id }: { path: string; id?: string }) {
  useEffect(() => {
    if (id) setActiveSession(id)
  }, [id])

  return <MessageHistory />
}

function HomePage(_props: { path: string }) {
  if (activeSessionId.value) {
    return <MessageHistory />
  }

  return (
    <div class="app-chat">
      <div class="chat-welcome">
        <h2>Rooster</h2>
        <p>Start a new conversation</p>
      </div>
      <div class="chat-input-area">
        <ChatInput />
      </div>
    </div>
  )
}

export function App({ url }: { url?: string }) {
  useEffect(() => {
    initChat()
    void loadSessions()
    void loadSettings()
  }, [])

  return (
    <div class="app-layout">
      <header class="Header">
        <div class="Header-item">
          <a class="Header-link f4 text-bold" href="/">Rooster</a>
        </div>
        <div class="Header-item Header-item--full" />
        <div class="Header-item">
          <HeaderSettings />
        </div>
      </header>
      <div class="app-main">
        <nav class="app-sidebar">
          <SessionList />
        </nav>
        <Router {...(url ? { url } : {})}>
          <HomePage path="/" />
          <ChatPage path="/session/:id" />
        </Router>
      </div>
    </div>
  )
}
