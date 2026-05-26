import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api, ApiError } from '../src/api/client.js'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('get', () => {
    it('should fetch and parse JSON', async () => {
      const mockData = { sessions: [], total: 0 }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 }),
      )

      const result = await api.get<typeof mockData>('/api/sessions')
      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'GET',
      })
    })

    it('should throw ApiError on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Not found', { status: 404 }),
      )

      const err = await api.get('/api/sessions/x').catch((e: unknown) => e) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(404)
      expect(err.body).toBe('Not found')
      expect(err.message).toContain('API 404')
    })
  })

  describe('post', () => {
    it('should send JSON body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      await api.post('/api/test', { name: 'hello' })
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"hello"}',
      })
    })

    it('should send without body when not provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      await api.post('/api/test')
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
      })
    })
  })

  describe('put', () => {
    it('should send PUT with body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      await api.put('/api/test', { value: 1 })
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{"value":1}',
      })
    })
  })

  describe('del', () => {
    it('should send DELETE', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

      await api.del('/api/test/1')
      expect(fetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE',
      })
    })
  })

  describe('ApiError', () => {
    it('should have status and body fields', () => {
      const err = new ApiError(500, 'Internal Server Error')
      expect(err.status).toBe(500)
      expect(err.body).toBe('Internal Server Error')
      expect(err.name).toBe('ApiError')
      expect(err.message).toBe('API 500: Internal Server Error')
    })
  })
})
