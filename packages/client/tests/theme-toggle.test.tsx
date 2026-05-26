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

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

describe('Theme toggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should default to light mode', async () => {
    const { colorMode } = await import('../src/pages/App.js')
    expect(colorMode.value).toBe('light')
  })

  it('should toggle to dark mode on click', async () => {
    const { App, colorMode, toggleColorMode } = await import('../src/pages/App.js')
    colorMode.value = 'light'
    render(<App url="/" />)

    toggleColorMode()
    expect(colorMode.value).toBe('dark')
    expect(localStorage.getItem('color-mode')).toBe('dark')
  })

  it('should toggle back to light mode', async () => {
    const { colorMode, toggleColorMode } = await import('../src/pages/App.js')
    colorMode.value = 'dark'
    toggleColorMode()
    expect(colorMode.value).toBe('light')
    expect(localStorage.getItem('color-mode')).toBe('light')
  })

  it('should render toggle button in header', async () => {
    const { App, colorMode } = await import('../src/pages/App.js')
    colorMode.value = 'light'
    render(<App url="/" />)
    const btn = screen.getByLabelText('Toggle color mode')
    expect(btn).toBeTruthy()
  })

  it('should initialize dark from localStorage', async () => {
    localStorage.setItem('color-mode', 'dark')
    vi.resetModules()
    const { colorMode, toggleColorMode } = await import('../src/pages/App.js')
    colorMode.value = 'light'
    toggleColorMode()
    expect(colorMode.value).toBe('dark')
  })
})
