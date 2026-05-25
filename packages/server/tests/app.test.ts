import { describe, it, expect } from 'vitest'
import { app } from '../src/app.js'

describe('app', () => {
  it('should respond 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })

  describe('GET /health', () => {
    it('should return status ok with timestamp', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string; timestamp: string }
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
      expect(new Date(body.timestamp).getTime()).not.toBeNaN()
    })
  })
})
