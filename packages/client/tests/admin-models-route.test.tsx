/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/preact'
import { activeSessionId, messages, loading } from '../src/state/sessions.js'

const mockFetchSessions = vi.fn()
const mockFetchMessages = vi.fn()
const mockFetchModels = vi.fn()
const mockFetchProviders = vi.fn()

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
  fetchModels: (...args: unknown[]) => mockFetchModels(...args) as unknown,
  fetchProviders: (...args: unknown[]) => mockFetchProviders(...args) as unknown,
}))

vi.mock('../src/api/health.js', () => ({
  fetchHealth: vi.fn().mockResolvedValue({ status: 'ok', timestamp: '', bridge: 'connected' }),
}))

describe('Admin models route', () => {
  beforeEach(() => {
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    mockFetchSessions.mockReset()
    mockFetchSessions.mockResolvedValue({ sessions: [], total: 0 })
    mockFetchMessages.mockReset()
    mockFetchModels.mockReset()
    mockFetchModels.mockResolvedValue([])
    mockFetchProviders.mockReset()
    mockFetchProviders.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the AdminModelsPage at /admin/models instead of the phase placeholder', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/admin/models" />)

    await waitFor(() => {
      expect(screen.getByText(/Read-only preview/i)).toBeTruthy()
    })

    expect(screen.queryByText(/ships in a later phase/i)).toBeNull()
  })

  it('keeps the phase placeholder for other admin slugs (e.g. /admin/files)', async () => {
    const { App } = await import('../src/pages/App.js')
    render(<App url="/admin/files" />)

    expect(screen.getByText(/ships in a later phase/i)).toBeTruthy()
    expect(screen.queryByText(/Read-only preview/i)).toBeNull()
  })
})
