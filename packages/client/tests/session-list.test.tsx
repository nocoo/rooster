/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/preact'
import { SessionList } from '../src/components/SessionList.js'
import { sessions, activeSessionId, messages } from '../src/state/sessions.js'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

const mockRoute = vi.fn()
vi.mock('preact-router', () => ({
  route: (...args: unknown[]) => mockRoute(...args) as unknown,
}))

describe('SessionList', () => {
  beforeEach(() => {
    sessions.value = []
    activeSessionId.value = null
    messages.value = []
    mockRoute.mockClear()
  })

  it('should show empty message when no sessions', () => {
    render(<SessionList />)
    expect(screen.getByText('No sessions yet')).toBeTruthy()
  })

  it('should render session items', () => {
    sessions.value = [
      { id: 's1', title: 'First Session', started_at: '2025-01-01', last_active: new Date().toISOString() },
      { id: 's2', started_at: '2025-01-02', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('First Session')).toBeTruthy()
    expect(screen.getByText('Chat s2')).toBeTruthy()
  })

  it('should navigate to /session/:id on click', () => {
    sessions.value = [
      { id: 's1', title: 'Test', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    fireEvent.click(screen.getByText('Test'))
    expect(mockRoute).toHaveBeenCalledWith('/session/s1')
  })

  it('should highlight active session', () => {
    sessions.value = [
      { id: 's1', title: 'Active', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    const { container } = render(<SessionList />)
    const activeItem = container.querySelector('.session-item--active')
    expect(activeItem).toBeTruthy()
  })

  it('should remove session on delete button click', async () => {
    sessions.value = [
      { id: 's1', title: 'To Delete', started_at: '2025-01-01', last_active: new Date().toISOString() },
      { id: 's2', title: 'Keep', started_at: '2025-01-02', last_active: new Date().toISOString() },
    ]

    render(<SessionList />)
    const deleteButtons = screen.getAllByLabelText('Delete session')
    const firstBtn = deleteButtons[0]
    if (firstBtn) fireEvent.click(firstBtn)

    // Wait for async removeSession to complete
    await new Promise((r) => { setTimeout(r, 10) })

    expect(sessions.value).toHaveLength(1)
    expect(sessions.value[0]?.id).toBe('s2')
  })

  it('should display relative time for recent sessions', () => {
    const now = new Date()
    sessions.value = [
      { id: 's1', title: 'Recent', started_at: '2025-01-01', last_active: now.toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('just now')).toBeTruthy()
  })

  it('should display hours for sessions older than 60 min', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    sessions.value = [
      { id: 's1', title: 'Older', started_at: '2025-01-01', last_active: twoHoursAgo.toISOString() },
    ]

    render(<SessionList />)
    expect(screen.getByText('2h ago')).toBeTruthy()
  })
})
