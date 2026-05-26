/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { StreamingMessage } from '../src/components/StreamingMessage.js'
import { runStates } from '../src/state/chat.js'
import { activeSessionId } from '../src/state/sessions.js'

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
    activeSessionId.value = 'test-session'
    runStates.value = {}
  })

  afterEach(() => {
    cleanup()
  })

  it('should return null when no output or reasoning', () => {
    const { container } = render(<StreamingMessage />)
    expect(container.innerHTML).toBe('')
  })

  it('should render output text', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: 'Hello from assistant', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<StreamingMessage />)
    expect(screen.getByText('Hello from assistant')).toBeTruthy()
  })

  it('should render streaming label', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: 'partial', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<StreamingMessage />)
    expect(screen.getByText('Agent')).toBeTruthy()
  })

  it('should render reasoning in details element', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: 'output', reasoning: 'thinking process', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<StreamingMessage />)
    expect(screen.getByText('Thinking…')).toBeTruthy()
    expect(screen.getByText('thinking process')).toBeTruthy()
  })

  it('should render with only reasoning text', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: 'just thinking', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<StreamingMessage />)
    expect(screen.getByText('just thinking')).toBeTruthy()
  })
})
