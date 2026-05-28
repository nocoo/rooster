import Router from 'preact-router'
import { useEffect } from 'preact/hooks'
import { signal } from '@preact/signals'
import { SessionList } from '../components/SessionList.js'
import { MessageHistory } from '../components/MessageHistory.js'
import { ChatInput } from '../components/ChatInput.js'
import { HeaderSettings } from '../components/HeaderSettings.js'
import { DebugPanel } from '../components/DebugPanel.js'
import { BridgeStatus } from '../components/BridgeStatus.js'
import { AdminLayout } from './Admin.js'
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

  const currentPath = url ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const isAdmin = currentPath.startsWith('/admin')

  return (
    <div class="app-layout">
      <header class="app-header">
        <a class="app-brand" href="/" aria-label="rooster home">
          <span class="app-brand-mark" aria-hidden="true">🐓</span>
          <span class="app-brand-name">rooster</span>
        </a>
        <div class="app-header-settings">
          {!isAdmin && <HeaderSettings />}
        </div>
        <div class="app-header-actions">
          <BridgeStatus />
          <a
            class={`btn btn-sm app-header-admin-link${isAdmin ? ' app-header-admin-link--active' : ''}`}
            href="/admin"
            aria-label="Open admin"
            {...(isAdmin ? { 'aria-current': 'page' } : {})}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z" />
            </svg>
            <span class="app-header-admin-text">Admin</span>
          </a>
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
        {isAdmin ? (
          <Router {...(url ? { url } : {})}>
            <AdminLayout path="/admin" />
            <AdminLayout path="/admin/:section" />
          </Router>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
