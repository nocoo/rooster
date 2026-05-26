import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn(),
  fetchMessages: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
}))

import { fetchSessions, fetchMessages, deleteSession, renameSession } from '../src/api/sessions.js'
import {
  sessions,
  sessionsTotal,
  activeSessionId,
  messages,
  loading,
  error,
  activeSession,
  loadSessions,
  loadMessages,
  setActiveSession,
  removeSession,
  updateSessionTitle,
} from '../src/state/sessions.js'

const mockFetchSessions = vi.mocked(fetchSessions)
const mockFetchMessages = vi.mocked(fetchMessages)
const mockDeleteSession = vi.mocked(deleteSession)
const mockRenameSession = vi.mocked(renameSession)

describe('sessions state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessions.value = []
    sessionsTotal.value = 0
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    error.value = null
  })

  describe('loadSessions', () => {
    it('should load sessions and set state', async () => {
      const data = {
        sessions: [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }],
        total: 1,
      }
      mockFetchSessions.mockResolvedValue(data)

      await loadSessions()

      expect(sessions.value).toEqual(data.sessions)
      expect(sessionsTotal.value).toBe(1)
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('should pass options to fetchSessions', async () => {
      mockFetchSessions.mockResolvedValue({ sessions: [], total: 0 })
      await loadSessions({ limit: 10, profile: 'coding' })
      expect(mockFetchSessions).toHaveBeenCalledWith({ limit: 10, profile: 'coding' })
    })

    it('should set error on failure', async () => {
      mockFetchSessions.mockRejectedValue(new Error('Network error'))
      await loadSessions()
      expect(error.value).toBe('Network error')
      expect(loading.value).toBe(false)
    })

    it('should set generic error for non-Error throws', async () => {
      mockFetchSessions.mockRejectedValue('string error')
      await loadSessions()
      expect(error.value).toBe('Failed to load sessions')
    })
  })

  describe('loadMessages', () => {
    it('should load messages for a session', async () => {
      const data = {
        messages: [{ id: 'm1', session_id: 's1', role: 'user' as const, content: 'hi', timestamp: '2025-01-01' }],
      }
      mockFetchMessages.mockResolvedValue(data)

      await loadMessages('s1')

      expect(messages.value).toEqual(data.messages)
      expect(loading.value).toBe(false)
    })

    it('should set error on failure', async () => {
      mockFetchMessages.mockRejectedValue(new Error('Not found'))
      await loadMessages('s1')
      expect(error.value).toBe('Not found')
    })

    it('should set generic error for non-Error throws', async () => {
      mockFetchMessages.mockRejectedValue(42)
      await loadMessages('s1')
      expect(error.value).toBe('Failed to load messages')
    })
  })

  describe('setActiveSession', () => {
    it('should set active id and trigger message load', () => {
      mockFetchMessages.mockResolvedValue({ messages: [] })
      setActiveSession('s1')
      expect(activeSessionId.value).toBe('s1')
      expect(mockFetchMessages).toHaveBeenCalledWith('s1')
    })

    it('should clear messages when set to null', () => {
      messages.value = [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', timestamp: '' }]
      setActiveSession(null)
      expect(activeSessionId.value).toBeNull()
      expect(messages.value).toEqual([])
    })
  })

  describe('activeSession computed', () => {
    it('should return the active session', () => {
      sessions.value = [
        { id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' },
        { id: 's2', started_at: '2025-01-02', last_active: '2025-01-02' },
      ]
      activeSessionId.value = 's2'
      expect(activeSession.value?.id).toBe('s2')
    })

    it('should return null when no match', () => {
      sessions.value = [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }]
      activeSessionId.value = 'nonexistent'
      expect(activeSession.value).toBeNull()
    })
  })

  describe('removeSession', () => {
    it('should delete and remove from list', async () => {
      mockDeleteSession.mockResolvedValue(undefined)
      sessions.value = [
        { id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' },
        { id: 's2', started_at: '2025-01-02', last_active: '2025-01-02' },
      ]
      sessionsTotal.value = 2

      await removeSession('s1')

      expect(mockDeleteSession).toHaveBeenCalledWith('s1')
      expect(sessions.value).toHaveLength(1)
      expect(sessions.value[0]?.id).toBe('s2')
      expect(sessionsTotal.value).toBe(1)
    })

    it('should clear active session if deleted', async () => {
      mockDeleteSession.mockResolvedValue(undefined)
      sessions.value = [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }]
      activeSessionId.value = 's1'
      messages.value = [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', timestamp: '' }]

      await removeSession('s1')

      expect(activeSessionId.value).toBeNull()
      expect(messages.value).toEqual([])
    })

    it('should not clear active session if different one deleted', async () => {
      mockDeleteSession.mockResolvedValue(undefined)
      sessions.value = [
        { id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' },
        { id: 's2', started_at: '2025-01-02', last_active: '2025-01-02' },
      ]
      activeSessionId.value = 's2'

      await removeSession('s1')

      expect(activeSessionId.value).toBe('s2')
    })
  })

  describe('updateSessionTitle', () => {
    it('should rename and update in list', async () => {
      mockRenameSession.mockResolvedValue(undefined)
      sessions.value = [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }]

      await updateSessionTitle('s1', 'New Title')

      expect(mockRenameSession).toHaveBeenCalledWith('s1', 'New Title')
      expect(sessions.value[0]?.title).toBe('New Title')
    })
  })
})
