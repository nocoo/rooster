/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/preact'
import { ClarifyDialog } from '../src/components/ClarifyDialog.js'
import { runStates } from '../src/state/chat.js'
import { activeSessionId } from '../src/state/sessions.js'

const mockSendClarifyRespond = vi.fn()

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
  sendApprovalRespond: vi.fn(),
  sendClarifyRespond: (...args: unknown[]) => mockSendClarifyRespond(...args) as unknown,
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

describe('ClarifyDialog', () => {
  beforeEach(() => {
    runStates.value = {}
    activeSessionId.value = null
    mockSendClarifyRespond.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render nothing when no pending clarify', () => {
    activeSessionId.value = 's1'
    const { container } = render(<ClarifyDialog />)
    expect(container.querySelector('.clarify-dialog')).toBeNull()
  })

  it('should render clarify dialog with question', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'Which file to edit?' }, error: null } }
    render(<ClarifyDialog />)
    expect(screen.getByText('Clarification Needed')).toBeTruthy()
    expect(screen.getByText('Which file to edit?')).toBeTruthy()
  })

  it('should render choice buttons when choices provided', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'Pick one', choices: ['a.ts', 'b.ts'] }, error: null } }
    render(<ClarifyDialog />)
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getByText('b.ts')).toBeTruthy()
  })

  it('should call respondClarify when choice button clicked', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'Pick one', choices: ['a.ts', 'b.ts'] }, error: null } }
    render(<ClarifyDialog />)
    fireEvent.click(screen.getByText('a.ts'))
    expect(mockSendClarifyRespond).toHaveBeenCalledWith('s1', 'clr-1', 'a.ts')
  })

  it('should have an input field for free text', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What do you want?' }, error: null } }
    render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    expect(input).toBeTruthy()
  })

  it('should send free text on Enter key', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What?' }, error: null } }
    render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    fireEvent.input(input, { target: { value: 'my answer' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSendClarifyRespond).toHaveBeenCalledWith('s1', 'clr-1', 'my answer')
  })

  it('should disable input and buttons when responding', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'Pick', choices: ['a'], responding: true }, error: null } }
    render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    expect((input as HTMLInputElement).disabled).toBe(true)
    const choiceBtn = screen.getByText('a')
    expect((choiceBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('should not send when input is empty', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What?' }, error: null } }
    render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockSendClarifyRespond).not.toHaveBeenCalled()
  })

  it('should not send on non-Enter key press', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What?' }, error: null } }
    render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    fireEvent.input(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'a' })
    expect(mockSendClarifyRespond).not.toHaveBeenCalled()
  })

  it('should render timeout when timeout_ms is provided', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What?', timeout_ms: 60000 }, error: null } }
    render(<ClarifyDialog />)
    expect(screen.getByText('Timeout: 60s')).toBeTruthy()
  })

  it('should not render timeout when timeout_ms is absent', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'What?' }, error: null } }
    render(<ClarifyDialog />)
    expect(screen.queryByText(/Timeout/)).toBeNull()
  })

  it('should reset input when clarify_id changes', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-1', question: 'First?' }, error: null } }
    const { rerender } = render(<ClarifyDialog />)
    const input = screen.getByPlaceholderText('Type a response…')
    fireEvent.input(input, { target: { value: 'partial typing' } })
    expect((input as HTMLInputElement).value).toBe('partial typing')

    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: { clarify_id: 'clr-2', question: 'Second?' }, error: null } }
    rerender(<ClarifyDialog />)
    const input2 = screen.getByPlaceholderText('Type a response…')
    expect((input2 as HTMLInputElement).value).toBe('')
  })
})
