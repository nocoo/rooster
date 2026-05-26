/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/preact'
import { ToolTrace } from '../src/components/ToolTrace.js'
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

describe('ToolTrace', () => {
  beforeEach(() => {
    activeSessionId.value = 'test-session'
    runStates.value = {}
  })

  afterEach(() => {
    cleanup()
  })

  it('should return null when no events', () => {
    const { container } = render(<ToolTrace />)
    expect(container.innerHTML).toBe('')
  })

  it('should render tool event with running status', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [{ tool_call_id: 'tc1', name: 'read_file', status: 'started' }], agentEvents: [], error: null } }
    render(<ToolTrace />)
    expect(screen.getByText('read_file')).toBeTruthy()
    expect(screen.getByText('running')).toBeTruthy()
  })

  it('should render completed tool event with done status', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [{ tool_call_id: 'tc1', name: 'bash', status: 'completed', output: 'ok', duration: 150 }], agentEvents: [], error: null } }
    render(<ToolTrace />)
    expect(screen.getByText('bash')).toBeTruthy()
    expect(screen.getByText('done')).toBeTruthy()
    expect(screen.getByText('150ms')).toBeTruthy()
  })

  it('should render tool error', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [{ tool_call_id: 'tc1', name: 'write_file', status: 'completed', output: '', error: 'permission denied' }], agentEvents: [], error: null } }
    render(<ToolTrace />)
    expect(screen.getByText('permission denied')).toBeTruthy()
  })

  it('should render tool arguments', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [{ tool_call_id: 'tc1', name: 'edit', status: 'started', arguments: '{"path":"/foo.ts"}' }], agentEvents: [], error: null } }
    render(<ToolTrace />)
    expect(screen.getByText('{"path":"/foo.ts"}')).toBeTruthy()
  })

  it('should render multiple tool events', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [
      { tool_call_id: 'tc1', name: 'read_file', status: 'completed', output: 'data' },
      { tool_call_id: 'tc2', name: 'bash', status: 'started' },
    ], agentEvents: [], error: null } }
    render(<ToolTrace />)
    expect(screen.getByText('read_file')).toBeTruthy()
    expect(screen.getByText('bash')).toBeTruthy()
  })
})
