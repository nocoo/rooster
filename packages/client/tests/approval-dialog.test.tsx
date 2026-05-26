/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/preact'
import { ApprovalDialog } from '../src/components/ApprovalDialog.js'
import { runStates } from '../src/state/chat.js'
import { activeSessionId } from '../src/state/sessions.js'

const mockSendApprovalRespond = vi.fn()

vi.mock('../src/ws/chat.js', () => ({
  connect: vi.fn(),
  setHandlers: vi.fn(),
  sendRun: vi.fn(),
  sendAbort: vi.fn(),
  sendApprovalRespond: (...args: unknown[]) => mockSendApprovalRespond(...args) as unknown,
  sendClarifyRespond: vi.fn(),
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

describe('ApprovalDialog', () => {
  beforeEach(() => {
    runStates.value = {}
    activeSessionId.value = null
    mockSendApprovalRespond.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render nothing when no pending approval', () => {
    activeSessionId.value = 's1'
    const { container } = render(<ApprovalDialog />)
    expect(container.querySelector('.approval-dialog')).toBeNull()
  })

  it('should render approval dialog with command and choices', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'rm -rf /', choices: ['allow', 'deny'] }, clarify: null, error: null } }
    render(<ApprovalDialog />)
    expect(screen.getByText('Permission Required')).toBeTruthy()
    expect(screen.getByText('rm -rf /')).toBeTruthy()
    expect(screen.getByText('allow')).toBeTruthy()
    expect(screen.getByText('deny')).toBeTruthy()
  })

  it('should render description when provided', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'cmd', description: 'This deletes files', choices: ['allow', 'deny'] }, clarify: null, error: null } }
    render(<ApprovalDialog />)
    expect(screen.getByText('This deletes files')).toBeTruthy()
  })

  it('should render permanent note when allow_permanent is true', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'cmd', choices: ['allow', 'deny'], allow_permanent: true }, clarify: null, error: null } }
    render(<ApprovalDialog />)
    expect(screen.getByText('This can be allowed permanently.')).toBeTruthy()
  })

  it('should call respondApproval on button click', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'cmd', choices: ['allow', 'deny'] }, clarify: null, error: null } }
    render(<ApprovalDialog />)
    fireEvent.click(screen.getByText('allow'))
    expect(mockSendApprovalRespond).toHaveBeenCalledWith('s1', 'apr-1', 'allow')
  })

  it('should disable buttons when responding', () => {
    activeSessionId.value = 's1'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: { approval_id: 'apr-1', command: 'cmd', choices: ['allow', 'deny'], responding: true }, clarify: null, error: null } }
    render(<ApprovalDialog />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => { expect((btn as HTMLButtonElement).disabled).toBe(true) })
  })
})
