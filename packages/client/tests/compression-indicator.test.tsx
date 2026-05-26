/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/preact'

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
  sendResume: vi.fn(),
  connected: { value: false },
}))

vi.mock('preact-router', () => ({
  route: vi.fn(),
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

import { CompressionIndicator } from '../src/components/CompressionIndicator.js'
import { compressionStates } from '../src/state/chat.js'
import { activeSessionId } from '../src/state/sessions.js'

describe('CompressionIndicator', () => {
  beforeEach(() => {
    activeSessionId.value = 's1'
    compressionStates.value = {}
  })

  afterEach(() => {
    cleanup()
  })

  it('should render nothing when no compression state', () => {
    const { container } = render(<CompressionIndicator />)
    expect(container.querySelector('.compression-indicator')).toBeNull()
  })

  it('should render compressing state with details', () => {
    compressionStates.value = {
      's1': { status: 'compressing', message_count: 42, token_count: 128000, source: 'auto' },
    }
    const { container } = render(<CompressionIndicator />)
    const el = container.querySelector('.compression-indicator--active')
    expect(el).toBeTruthy()
    expect(el?.textContent).toContain('Compressing context…')
    expect(el?.textContent).toContain('42 messages')
    expect(el?.textContent).toContain('128.0k tokens')
    expect(el?.textContent).toContain('source: auto')
  })

  it('should render completed state with token reduction', () => {
    compressionStates.value = {
      's1': {
        status: 'completed',
        compressed: true,
        beforeTokens: 128000,
        afterTokens: 24000,
        summaryTokens: 3200,
        totalMessages: 42,
        resultMessages: 8,
        source: 'auto',
      },
    }
    const { container } = render(<CompressionIndicator />)
    const el = container.querySelector('.compression-indicator--done')
    expect(el).toBeTruthy()
    expect(el?.textContent).toContain('Context compressed')
    expect(el?.textContent).toContain('128.0k → 24.0k tokens')
    expect(el?.textContent).toContain('summary: 3.2k')
    expect(el?.textContent).toContain('42 → 8 messages')
    expect(el?.textContent).toContain('source: auto')
  })

  it('should render compressing state with minimal fields', () => {
    compressionStates.value = {
      's1': { status: 'compressing' },
    }
    const { container } = render(<CompressionIndicator />)
    const el = container.querySelector('.compression-indicator--active')
    expect(el).toBeTruthy()
    expect(el?.textContent).toBe('Compressing context…')
  })

  it('should render completed state with minimal fields', () => {
    compressionStates.value = {
      's1': { status: 'completed' },
    }
    const { container } = render(<CompressionIndicator />)
    const el = container.querySelector('.compression-indicator--done')
    expect(el).toBeTruthy()
    expect(el?.textContent).toBe('Context compressed')
  })

  it('should not render for different session', () => {
    compressionStates.value = {
      's2': { status: 'compressing', message_count: 10 },
    }
    const { container } = render(<CompressionIndicator />)
    expect(container.querySelector('.compression-indicator')).toBeNull()
  })

  it('should format tokens below 1000 as plain numbers', () => {
    compressionStates.value = {
      's1': { status: 'compressing', token_count: 500 },
    }
    const { container } = render(<CompressionIndicator />)
    expect(container.textContent).toContain('500 tokens')
  })
})
