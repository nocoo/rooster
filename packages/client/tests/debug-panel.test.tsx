/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { DebugPanel } from '../src/components/DebugPanel.js'
import { debugEnabled, debugEvents } from '../src/state/debug.js'

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
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

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}))

describe('DebugPanel', () => {
  beforeEach(() => {
    debugEnabled.value = false
    debugEvents.value = []
  })

  afterEach(() => {
    cleanup()
  })

  it('should not render when debug is disabled', () => {
    const { container } = render(<DebugPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('should render when debug is enabled', () => {
    debugEnabled.value = true
    render(<DebugPanel />)
    expect(screen.getByText('Debug Events (0)')).toBeTruthy()
  })

  it('should show empty state message', () => {
    debugEnabled.value = true
    render(<DebugPanel />)
    expect(screen.getByText('No events captured yet.')).toBeTruthy()
  })

  it('should display events', () => {
    debugEnabled.value = true
    debugEvents.value = [
      { id: '1', time: '2025-01-01T00:00:00Z', event: 'run.started', payload: { session_id: 's1' } },
    ]
    render(<DebugPanel />)
    expect(screen.getByText('run.started')).toBeTruthy()
    expect(screen.getByText('Debug Events (1)')).toBeTruthy()
  })

  it('should show clear button', () => {
    debugEnabled.value = true
    render(<DebugPanel />)
    expect(screen.getByText('Clear')).toBeTruthy()
  })
})
