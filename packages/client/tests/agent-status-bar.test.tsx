/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { AgentStatusBar } from '../src/components/AgentStatusBar.js'
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

describe('AgentStatusBar', () => {
  beforeEach(() => {
    activeSessionId.value = 'test-session'
    runStates.value = {}
  })

  afterEach(() => {
    cleanup()
  })

  it('should return null when no events', () => {
    const { container } = render(<AgentStatusBar />)
    expect(container.innerHTML).toBe('')
  })

  it('should render agent status with all fields', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [{
      type: 'status',
      profile: 'coding',
      model: 'claude-4',
      provider: 'anthropic',
      tool_count: 30,
    }], error: null } }
    render(<AgentStatusBar />)
    expect(screen.getByText('status')).toBeTruthy()
    expect(screen.getByText(/profile: coding/)).toBeTruthy()
    expect(screen.getByText(/model: claude-4/)).toBeTruthy()
    expect(screen.getByText(/provider: anthropic/)).toBeTruthy()
    expect(screen.getByText(/tools: 30/)).toBeTruthy()
  })

  it('should render minimal event with only type', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [{ type: 'custom_event' }], error: null } }
    render(<AgentStatusBar />)
    expect(screen.getAllByText('custom_event').length).toBeGreaterThanOrEqual(1)
  })

  it('should render multiple events', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [
      { type: 'init', profile: 'default' },
      { type: 'progress', model: 'gpt-4' },
    ], error: null } }
    render(<AgentStatusBar />)
    expect(screen.getByText('init')).toBeTruthy()
    expect(screen.getByText('progress')).toBeTruthy()
  })
})
