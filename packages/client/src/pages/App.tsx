import Router from 'preact-router'
import { useEffect } from 'preact/hooks'
import { signal } from '@preact/signals'
import { SessionList } from '../components/SessionList.js'
import { MessageHistory } from '../components/MessageHistory.js'
import { ChatInput } from '../components/ChatInput.js'
import { HeaderSettings } from '../components/HeaderSettings.js'
import { DebugPanel } from '../components/DebugPanel.js'
import { BridgeStatus } from '../components/BridgeStatus.js'
import { loadSessions, setActiveSession, activeSessionId } from '../state/sessions.js'
import { initChat } from '../state/chat.js'
import { loadSettings } from '../state/settings.js'
import { startHealthPolling, stopHealthPolling } from '../state/health.js'
import { debugEnabled, toggleDebug } from '../state/debug.js'

function getInitialColorMode(): 'light' | 'dark' {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const stored = globalThis.localStorage?.getItem('color-mode')
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const colorMode = signal<'light' | 'dark'>(getInitialColorMode())

export function toggleColorMode(): void {
  const next = colorMode.value === 'light' ? 'dark' : 'light'
  colorMode.value = next
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.colorMode = next
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    globalThis.localStorage?.setItem('color-mode', next)
  } catch { /* SSR/test */ }
}

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
        <p class="f4 color-fg-muted">Start a new conversation</p>
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
    startHealthPolling()
    return () => { stopHealthPolling() }
  }, [])

  return (
    <div class="app-layout">
      <header class="app-header">
        <div class="app-header-left">
          <HeaderSettings />
        </div>
        <div class="app-header-right">
          <BridgeStatus />
          <button
            type="button"
            class={`btn-octicon${debugEnabled.value ? ' btn-octicon--active' : ''}`}
            aria-label="Toggle debug panel"
            onClick={toggleDebug}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.72.22a.75.75 0 0 1 1.06 0l1 1a.75.75 0 0 1-1.06 1.06l-.22-.22A3.98 3.98 0 0 0 4 5.75v.5h3.25a.75.75 0 0 1 0 1.5H4v.5c0 .57.12 1.11.34 1.6l2.72-2.72a.75.75 0 0 1 1.06 1.06L5.56 10.7A4 4 0 0 0 8 12h.25v-1.25a.75.75 0 0 1 1.5 0V12H10a4 4 0 0 0 2.44-1.3l-2.56-2.56a.75.75 0 0 1 1.06-1.06l2.72 2.72c.22-.49.34-1.03.34-1.6v-.5h-3.25a.75.75 0 0 1 0-1.5H14v-.5a3.98 3.98 0 0 0-1.5-3.11l-.22.22a.75.75 0 0 1-1.06-1.06l1-1a.75.75 0 0 1 1.06 0l.22.22A5.5 5.5 0 0 1 15.5 5.75v2.5a5.5 5.5 0 0 1-5.5 5.5h-.25v1.5a.75.75 0 0 1-1.5 0v-1.5H8a5.5 5.5 0 0 1-5.5-5.5v-2.5A5.5 5.5 0 0 1 4.5.44l.22-.22Z" />
            </svg>
          </button>
          <button
            type="button"
            class="btn-octicon"
            aria-label="Toggle color mode"
            onClick={toggleColorMode}
          >
            {colorMode.value === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.221-7.832.749.749 0 0 1 0-1.001Z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.75.75 0 0 1-1.06 1.06L2.343 3.404a.75.75 0 0 1 0-1.06Zm9.193 9.193a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM0 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm13 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 13 8ZM2.343 13.657a.75.75 0 0 1 0-1.06l1.06-1.061a.75.75 0 0 1 1.061 1.06l-1.06 1.061a.75.75 0 0 1-1.061 0Zm9.193-9.193a.75.75 0 0 1 0-1.06l1.061-1.061a.75.75 0 1 1 1.06 1.06l-1.06 1.061a.75.75 0 0 1-1.061 0Z" />
              </svg>
            )}
          </button>
        </div>
      </header>
      <div class="app-main">
        <nav class="app-sidebar">
          <SessionList />
        </nav>
        <div class="app-content">
          <Router {...(url ? { url } : {})}>
            <HomePage path="/" />
            <ChatPage path="/session/:id" />
          </Router>
        </div>
        <DebugPanel />
      </div>
    </div>
  )
}
