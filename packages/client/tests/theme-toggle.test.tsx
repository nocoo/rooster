/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
}))

vi.mock('preact-router', () => ({
  default: ({ children }: { children: unknown }) => children,
  route: vi.fn(),
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' }),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

function ensureLocalStorage(): Storage {
  if (typeof globalThis.localStorage === 'undefined') {
    let store = new Map<string, string>()
    const mock: Storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store = new Map() },
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
    }
    Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true })
  }
  return globalThis.localStorage
}

describe('Theme toggle', () => {
  let storage: Storage

  beforeEach(() => {
    storage = ensureLocalStorage()
    storage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should default to light mode', async () => {
    const { colorMode } = await import('../src/pages/App.js')
    expect(colorMode.value).toBe('light')
  })

  it('should toggle to dark mode', async () => {
    const { colorMode, toggleColorMode } = await import('../src/pages/App.js')
    colorMode.value = 'light'
    toggleColorMode()
    expect(colorMode.value).toBe('dark')
    expect(storage.getItem('color-mode')).toBe('dark')
  })

  it('should toggle back to light mode', async () => {
    const { colorMode, toggleColorMode } = await import('../src/pages/App.js')
    colorMode.value = 'dark'
    toggleColorMode()
    expect(colorMode.value).toBe('light')
    expect(storage.getItem('color-mode')).toBe('light')
  })

  it('should render toggle button in header', async () => {
    const { App, colorMode } = await import('../src/pages/App.js')
    colorMode.value = 'light'
    render(<App url="/" />)
    const btn = screen.getByLabelText('Toggle color mode')
    expect(btn).toBeTruthy()
  })

  it('should read persisted dark mode from localStorage on init', async () => {
    storage.setItem('color-mode', 'dark')
    vi.resetModules()
    const { colorMode } = await import('../src/pages/App.js')
    expect(colorMode.value).toBe('dark')
  })
})
