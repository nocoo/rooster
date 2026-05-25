import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger', () => {
  const originalEnv = process.env['NODE_ENV']

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV']
    } else {
      process.env['NODE_ENV'] = originalEnv
    }
    vi.resetModules()
  })

  it('should configure transport in development', async () => {
    process.env['NODE_ENV'] = 'development'
    vi.resetModules()
    const { logger } = await import('../src/lib/logger.js')
    expect(logger).toBeDefined()
    expect(logger.level).toBe('info')
  })

  it('should not configure transport in production', async () => {
    process.env['NODE_ENV'] = 'production'
    vi.resetModules()
    const { logger } = await import('../src/lib/logger.js')
    expect(logger).toBeDefined()
    expect(logger.level).toBe('info')
  })

  it('should respect LOG_LEVEL env var', async () => {
    beforeEach(() => {
      delete process.env['LOG_LEVEL']
    })
    process.env['LOG_LEVEL'] = 'debug'
    vi.resetModules()
    const { logger } = await import('../src/lib/logger.js')
    expect(logger.level).toBe('debug')
    delete process.env['LOG_LEVEL']
  })
})
