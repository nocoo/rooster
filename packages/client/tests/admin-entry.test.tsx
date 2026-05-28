/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { activeSessionId, messages, loading } from '../src/state/sessions.js'

const mockFetchSessions = vi.fn()
const mockFetchMessages = vi.fn()

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: (...args: unknown[]) => mockFetchSessions(...args) as unknown,
  fetchMessages: (...args: unknown[]) => mockFetchMessages(...args) as unknown,
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' }),
}))

describe('App header admin entry', () => {
  beforeEach(() => {
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    mockFetchSessions.mockReset()
    mockFetchSessions.mockResolvedValue({ sessions: [], total: 0 })
    mockFetchMessages.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an Admin entry in the header that links to /admin with visible text', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/" />)

    const entry = screen.getByRole('link', { name: 'Open admin' })
    expect(entry.getAttribute('href')).toBe('/admin')
    expect(entry.textContent).toContain('Admin')
  })

  it('shows chat HeaderSettings on chat routes', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/" />)

    expect(screen.getByLabelText('Profile')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByLabelText('Provider')).toBeTruthy()
  })

  it('hides chat HeaderSettings on admin routes', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/admin" />)

    expect(screen.queryByLabelText('Profile')).toBeNull()
    expect(screen.queryByLabelText('Model')).toBeNull()
    expect(screen.queryByLabelText('Provider')).toBeNull()
  })

  it('marks the Admin entry as current page on /admin', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/admin" />)

    const entry = screen.getByRole('link', { name: 'Open admin' })
    expect(entry.getAttribute('aria-current')).toBe('page')
  })
})
