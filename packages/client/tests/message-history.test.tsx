/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/preact'
import { MessageHistory } from '../src/components/MessageHistory.js'
import { messages, loading, activeSessionId, sessions } from '../src/state/sessions.js'
import { runStates } from '../src/state/chat.js'

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
  sendApprovalRespond: vi.fn(),
  sendClarifyRespond: vi.fn(),
}))

describe('MessageHistory', () => {
  beforeEach(() => {
    sessions.value = []
    activeSessionId.value = null
    messages.value = []
    loading.value = false
    runStates.value = {}
  })

  it('should show placeholder when no active session', () => {
    render(<MessageHistory />)
    expect(screen.getByText('Select a session to view history')).toBeTruthy()
  })

  it('should show loading state', () => {
    sessions.value = [{ id: 's1', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    loading.value = true

    render(<MessageHistory />)
    expect(screen.getByText('Loading')).toBeTruthy()
  })

  it('should show empty message when no messages', () => {
    sessions.value = [{ id: 's1', title: 'Test', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'

    render(<MessageHistory />)
    expect(screen.getByText('No messages in this session')).toBeTruthy()
  })

  it('should render messages with role labels', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    messages.value = [
      { id: 'm1', session_id: 's1', role: 'user', content: 'Hello', timestamp: '2025-01-01T12:00:00Z' },
      { id: 'm2', session_id: 's1', role: 'assistant', content: 'Hi there', timestamp: '2025-01-01T12:00:01Z' },
    ]

    render(<MessageHistory />)
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
    expect(screen.getByText('Human')).toBeTruthy()
    expect(screen.getByText('Agent')).toBeTruthy()
  })

  it('should render reasoning block for assistant messages with reasoning', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    messages.value = [
      { id: 'm1', session_id: 's1', role: 'assistant', content: 'Answer', reasoning: 'Let me think...', timestamp: '2025-01-01T12:00:00Z' },
    ]

    render(<MessageHistory />)
    expect(screen.getByText('Reasoning')).toBeTruthy()
    expect(screen.getByText('Let me think...')).toBeTruthy()
    expect(screen.getByText('Answer')).toBeTruthy()
  })

  it('should not render reasoning block when reasoning is empty', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    messages.value = [
      { id: 'm1', session_id: 's1', role: 'assistant', content: 'Just an answer', timestamp: '2025-01-01T12:00:00Z' },
    ]

    const { container } = render(<MessageHistory />)
    expect(container.querySelector('.reasoning-block')).toBeNull()
    expect(screen.getByText('Just an answer')).toBeTruthy()
  })

  it('should render ApprovalDialog when pending approval exists', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'rm -rf /', choices: ['allow', 'deny'] }, clarify: null, error: null } }

    render(<MessageHistory />)
    expect(screen.getByText('Permission Required')).toBeTruthy()
  })

  it('should render ClarifyDialog when pending clarify exists', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'Which file?' }, error: null } }

    render(<MessageHistory />)
    expect(screen.getByText('Clarification Needed')).toBeTruthy()
  })

  it('should not render dialogs when no pending approval or clarify', () => {
    sessions.value = [{ id: 's1', title: 'Chat', started_at: '2025-01-01', last_active: '2025-01-01' }]
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }

    const { container } = render(<MessageHistory />)
    expect(container.querySelector('.approval-dialog')).toBeNull()
    expect(container.querySelector('.clarify-dialog')).toBeNull()
  })
})
