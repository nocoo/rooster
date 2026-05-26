/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/preact'
import { MessageHistory } from '../src/components/MessageHistory.js'
import { messages, loading, activeSessionId, sessions } from '../src/state/sessions.js'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

describe('MessageHistory', () => {
  beforeEach(() => {
    sessions.value = []
    activeSessionId.value = null
    messages.value = []
    loading.value = false
  })

  it('should show placeholder when no active session', () => {
    render(<MessageHistory />)
    expect(screen.getByText('Select a session to view history')).toBeTruthy()
  })

  it('should show loading state', () => {
    sessions.value = [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    loading.value = true

    render(<MessageHistory />)
    expect(screen.getByText('Loading')).toBeTruthy()
  })

  it('should show empty message when no messages', () => {
    sessions.value = [{ id: 's1', title: 'Test', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'

    render(<MessageHistory />)
    expect(screen.getByText('No messages in this session')).toBeTruthy()
  })

  it('should render messages with role labels', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    messages.value = [
      { id: 'm1', session_id: 's1', role: 'user', content: 'Hello', timestamp: '2025-01-01T12:00:00Z' },
      { id: 'm2', session_id: 's1', role: 'assistant', content: 'Hi there', timestamp: '2025-01-01T12:00:01Z' },
    ]

    render(<MessageHistory />)
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
    expect(screen.getByText('user')).toBeTruthy()
    expect(screen.getByText('assistant')).toBeTruthy()
  })

  it('should show session title in header', () => {
    sessions.value = [{ id: 's1', title: 'My Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'

    render(<MessageHistory />)
    expect(screen.getByText('My Chat')).toBeTruthy()
  })

  it('should show truncated id when no title', () => {
    sessions.value = [{ id: 'abcdefgh-1234', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 'abcdefgh-1234'

    render(<MessageHistory />)
    expect(screen.getByText('abcdefgh')).toBeTruthy()
  })
})
