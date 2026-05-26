import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchSessions,
  fetchSession,
  deleteSession,
  renameSession,
  fetchMessages,
  fetchMessagesPaginated,
} from '../src/api/sessions.js'

vi.mock('../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(public status: number, public body: string) {
      super(`API ${String(status)}: ${body}`)
    }
  },
}))

import { api } from '../src/api/client.js'

const mockGet = vi.mocked(api.get)
const mockPost = vi.mocked(api.post)
const mockDel = vi.mocked(api.del)

describe('sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchSessions', () => {
    it('should call GET /api/hermes/sessions with no params', async () => {
      mockGet.mockResolvedValue({ sessions: [], total: 0 })
      const result = await fetchSessions()
      expect(mockGet).toHaveBeenCalledWith('/api/hermes/sessions')
      expect(result).toEqual({ sessions: [], total: 0 })
    })

    it('should include query params when provided', async () => {
      mockGet.mockResolvedValue({ sessions: [], total: 0 })
      await fetchSessions({ limit: 10, offset: 5, profile: 'coding' })
      expect(mockGet).toHaveBeenCalledWith(
        '/api/hermes/sessions?limit=10&offset=5&profile=coding',
      )
    })

    it('should only include provided params', async () => {
      mockGet.mockResolvedValue({ sessions: [], total: 0 })
      await fetchSessions({ limit: 20 })
      expect(mockGet).toHaveBeenCalledWith('/api/hermes/sessions?limit=20')
    })
  })

  describe('fetchSession', () => {
    it('should call GET /api/hermes/sessions/:id', async () => {
      const session = { id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }
      mockGet.mockResolvedValue(session)
      const result = await fetchSession('s1')
      expect(mockGet).toHaveBeenCalledWith('/api/hermes/sessions/s1')
      expect(result).toEqual(session)
    })
  })

  describe('deleteSession', () => {
    it('should call DELETE /api/hermes/sessions/:id', async () => {
      mockDel.mockResolvedValue({ ok: true })
      await deleteSession('s1')
      expect(mockDel).toHaveBeenCalledWith('/api/hermes/sessions/s1')
    })
  })

  describe('renameSession', () => {
    it('should call POST /api/hermes/sessions/:id/rename', async () => {
      mockPost.mockResolvedValue({ ok: true })
      await renameSession('s1', 'New Title')
      expect(mockPost).toHaveBeenCalledWith('/api/hermes/sessions/s1/rename', { title: 'New Title' })
    })
  })

  describe('fetchMessages', () => {
    it('should call GET conversations/:id/messages', async () => {
      mockGet.mockResolvedValue({ messages: [] })
      const result = await fetchMessages('s1')
      expect(mockGet).toHaveBeenCalledWith('/api/hermes/sessions/conversations/s1/messages')
      expect(result).toEqual({ messages: [] })
    })
  })

  describe('fetchMessagesPaginated', () => {
    it('should call with no params', async () => {
      mockGet.mockResolvedValue({ messages: [], total: 0 })
      await fetchMessagesPaginated('s1')
      expect(mockGet).toHaveBeenCalledWith(
        '/api/hermes/sessions/conversations/s1/messages/paginated',
      )
    })

    it('should include pagination params', async () => {
      mockGet.mockResolvedValue({ messages: [], total: 0 })
      await fetchMessagesPaginated('s1', { limit: 20, before: 'm5' })
      expect(mockGet).toHaveBeenCalledWith(
        '/api/hermes/sessions/conversations/s1/messages/paginated?limit=20&before=m5',
      )
    })

    it('should include after param', async () => {
      mockGet.mockResolvedValue({ messages: [], total: 0 })
      await fetchMessagesPaginated('s1', { after: 'm3' })
      expect(mockGet).toHaveBeenCalledWith(
        '/api/hermes/sessions/conversations/s1/messages/paginated?after=m3',
      )
    })
  })
})
