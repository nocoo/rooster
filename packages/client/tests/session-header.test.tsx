/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'
import { SessionHeader } from '../src/components/SessionHeader.js'
import { activeSessionId, sessions } from '../src/state/sessions.js'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
  searchSessions: vi.fn().mockResolvedValue({ results: [], total: 0 }),
  getExportUrl: (id: string, format: string) => `/api/hermes/sessions/${id}/export?format=${format}`,
}))

describe('SessionHeader', () => {
  beforeEach(() => {
    sessions.value = []
    activeSessionId.value = null
  })

  afterEach(() => {
    cleanup()
  })

  it('should render nothing when no active session', () => {
    const { container } = render(<SessionHeader />)
    expect(container.innerHTML).toBe('')
  })

  it('should show session title and time', () => {
    sessions.value = [
      { id: 's1', title: 'My Chat', started_at: '2025-01-01', last_active: '2025-06-15T10:30:00Z' },
    ]
    activeSessionId.value = 's1'

    render(<SessionHeader />)
    expect(screen.getByText('My Chat')).toBeTruthy()
  })

  it('should show truncated id when no title', () => {
    sessions.value = [
      { id: 'abcdef12-3456-7890', started_at: '2025-01-01', last_active: '2025-06-15T10:30:00Z' },
    ]
    activeSessionId.value = 'abcdef12-3456-7890'

    render(<SessionHeader />)
    expect(screen.getByText('Chat abcdef12')).toBeTruthy()
  })

  it('should have export JSON button', () => {
    sessions.value = [
      { id: 's1', title: 'Test', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    render(<SessionHeader />)
    expect(screen.getByLabelText('Export JSON')).toBeTruthy()
  })

  it('should have export Markdown button', () => {
    sessions.value = [
      { id: 's1', title: 'Test', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    render(<SessionHeader />)
    expect(screen.getByLabelText('Export Markdown')).toBeTruthy()
  })

  it('should have delete button', () => {
    sessions.value = [
      { id: 's1', title: 'Test', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    render(<SessionHeader />)
    expect(screen.getByLabelText('Delete session')).toBeTruthy()
  })

  it('should not throw on export click', () => {
    sessions.value = [
      { id: 's1abcdef', title: 'Export', started_at: '2025-01-01', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1abcdef'

    render(<SessionHeader />)
    const btn = screen.getByLabelText('Export JSON')
    expect(() => { fireEvent.click(btn) }).not.toThrow()
  })

  it('should remove session on delete click', async () => {
    sessions.value = [
      { id: 's1', title: 'To Delete', started_at: '2025-01-01', last_active: new Date().toISOString() },
      { id: 's2', title: 'Keep', started_at: '2025-01-02', last_active: new Date().toISOString() },
    ]
    activeSessionId.value = 's1'

    render(<SessionHeader />)
    const btn = screen.getByLabelText('Delete session')
    fireEvent.click(btn)

    await new Promise((r) => { setTimeout(r, 10) })
    expect(sessions.value).toHaveLength(1)
    expect(sessions.value[0]?.id).toBe('s2')
  })
})
