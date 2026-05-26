/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/preact'
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

describe('App routing integration', () => {
  beforeEach(() => {
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    mockFetchSessions.mockReset()
    mockFetchMessages.mockReset()
  })

  it('should show home placeholder at /', async () => {
    mockFetchSessions.mockResolvedValue({ sessions: [], total: 0 })

    const { App } = await import('../src/pages/App.js')
    render(<App url="/" />)
    expect(screen.getByText('Start a new conversation')).toBeTruthy()
  })

  it('should render MessageHistory at /session/:id and load messages', async () => {
    mockFetchSessions.mockResolvedValue({
      sessions: [{ id: 'sess-1', title: 'My Chat', started_at: '2025-01-01', last_active: '2025-01-01' }],
      total: 1,
    })
    mockFetchMessages.mockResolvedValue({
      messages: [
        { id: 'm1', session_id: 'sess-1', role: 'user', content: 'hello world', timestamp: '2025-01-01T12:00:00Z' },
        { id: 'm2', session_id: 'sess-1', role: 'assistant', content: 'hi back', timestamp: '2025-01-01T12:00:01Z' },
      ],
    })

    const { App } = await import('../src/pages/App.js')
    render(<App url="/session/sess-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('hello world').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('hi back').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('My Chat').length).toBeGreaterThanOrEqual(1)
  })
})
