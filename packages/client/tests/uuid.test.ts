import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { uuid } from '../src/lib/uuid.js'

describe('uuid', () => {
  it('should return a valid UUID v4 string', () => {
    const id = uuid()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should return unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uuid()))
    expect(ids.size).toBe(50)
  })

  describe('fallback when crypto.randomUUID is unavailable', () => {
    let originalRandomUUID: typeof crypto.randomUUID

    beforeEach(() => {
      originalRandomUUID = crypto.randomUUID.bind(crypto)
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, writable: true, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: originalRandomUUID, writable: true, configurable: true })
    })

    it('should produce a valid UUID v4 via getRandomValues fallback', () => {
      const id = uuid()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })
})
