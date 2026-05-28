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

describe('App header brand + layout', () => {
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

  it('renders an accessible brand link pointing at root with the product name', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/" />)

    const brand = screen.getByRole('link', { name: 'rooster home' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.textContent).toContain('rooster')
  })

  it('keeps existing settings selects and action buttons in the header', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/" />)

    expect(screen.getByLabelText('Profile')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByLabelText('Provider')).toBeTruthy()
    expect(screen.getByLabelText('Toggle debug panel')).toBeTruthy()
    expect(screen.getByLabelText('Toggle color mode')).toBeTruthy()
    expect(screen.getByLabelText(/Bridge status:/)).toBeTruthy()
  })

  it('uses a three-column grid container for the header', async () => {
    const { App } = await import('../src/pages/App.js')
    const { container } = render(<App url="/" />)

    const header = container.querySelector('.app-header')
    expect(header).toBeTruthy()
    expect(header?.querySelector('.app-brand')).toBeTruthy()
    expect(header?.querySelector('.app-header-settings')).toBeTruthy()
    expect(header?.querySelector('.app-header-actions')).toBeTruthy()
  })
})
