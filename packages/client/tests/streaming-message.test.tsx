/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { StreamingMessage } from '../src/components/StreamingMessage.js'
import { streamOutput, reasoningText } from '../src/state/chat.js'

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

describe('StreamingMessage', () => {
  beforeEach(() => {
    streamOutput.value = ''
    reasoningText.value = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('should return null when no output or reasoning', () => {
    const { container } = render(<StreamingMessage />)
    expect(container.innerHTML).toBe('')
  })

  it('should render output text', () => {
    streamOutput.value = 'Hello from assistant'
    render(<StreamingMessage />)
    expect(screen.getByText('Hello from assistant')).toBeTruthy()
  })

  it('should render streaming label', () => {
    streamOutput.value = 'partial'
    render(<StreamingMessage />)
    expect(screen.getByText('Agent')).toBeTruthy()
  })

  it('should render reasoning in details element', () => {
    streamOutput.value = 'output'
    reasoningText.value = 'thinking process'
    render(<StreamingMessage />)
    expect(screen.getByText('Reasoning')).toBeTruthy()
    expect(screen.getByText('thinking process')).toBeTruthy()
  })

  it('should render with only reasoning text', () => {
    reasoningText.value = 'just thinking'
    render(<StreamingMessage />)
    expect(screen.getByText('just thinking')).toBeTruthy()
  })
})
