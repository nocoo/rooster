/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'

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

vi.mock('../src/api/settings.js', () => ({
  fetchProfiles: vi.fn().mockResolvedValue([]),
  fetchModels: vi.fn().mockResolvedValue([]),
  fetchProviders: vi.fn().mockResolvedValue([]),
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

import { ChatInput } from '../src/components/ChatInput.js'
import { runStates } from '../src/state/chat.js'
import { selectedModel, selectedProfile, selectedProvider } from '../src/state/settings.js'
import { activeSessionId } from '../src/state/sessions.js'
import * as chatModule from '../src/state/chat.js'

describe('ChatInput', () => {
  let mockSend: ReturnType<typeof vi.spyOn>
  let mockAbort: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    activeSessionId.value = 'test-session'
    runStates.value = {}
    selectedModel.value = null
    selectedProfile.value = null
    selectedProvider.value = null
    mockSend = vi.spyOn(chatModule, 'send').mockImplementation(() => {})
    mockAbort = vi.spyOn(chatModule, 'abort').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should render textarea and send button', () => {
    render(<ChatInput />)
    expect(screen.getByLabelText('Message input')).toBeTruthy()
    expect(screen.getByText('Send')).toBeTruthy()
  })

  it('should call send on form submit', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'hello world'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(mockSend).toHaveBeenCalledWith('hello world', undefined)
  })

  it('should clear textarea after send', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'hello'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(textarea.value).toBe('')
  })

  it('should not send empty input', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = '   '
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should send on Enter key', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'test'
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(mockSend).toHaveBeenCalledWith('test', undefined)
  })

  it('should not send on Shift+Enter', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'test'
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should show Stop button when streaming', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    expect(screen.getByText('Stop')).toBeTruthy()
  })

  it('should call abort on Stop click', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    fireEvent.click(screen.getByText('Stop'))
    expect(mockAbort).toHaveBeenCalled()
  })

  it('should disable Stop button when aborting', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: true, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    const btn = screen.getByText('Stopping…')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('should disable textarea when streaming', () => {
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: null, output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    expect(textarea.disabled).toBe(true)
  })

  it('should not send on Enter during IME composition', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = '你好'
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, isComposing: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should not send on Enter with keyCode 229 (IME tail event)', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = '你好'
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 229 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should not send on Enter with which 229 (IME tail event)', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = '你好'
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, isComposing: false, which: 229 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should pass model and profile when selected', () => {
    selectedModel.value = 'gpt-4'
    selectedProfile.value = 'fast'
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'hi'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(mockSend).toHaveBeenCalledWith('hi', { model: 'gpt-4', profile: 'fast' })
  })

  it('should pass provider when selected', () => {
    selectedProvider.value = 'anthropic'
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'hi'
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(mockSend).toHaveBeenCalledWith('hi', { provider: 'anthropic' })
  })

  it('should disable textarea and Send when another session is working', () => {
    activeSessionId.value = 's2'
    runStates.value = { 's1': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    expect(textarea.disabled).toBe(true)
    const sendBtn = screen.getByText('Send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('should show Stop button for active streaming session even when globally working', () => {
    activeSessionId.value = 'test-session'
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    expect(screen.getByText('Stop')).toBeTruthy()
  })

  it('should send on Ctrl+Enter', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'ctrl send'
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true, shiftKey: false })
    expect(mockSend).toHaveBeenCalledWith('ctrl send', undefined)
  })

  it('should send on Cmd+Enter (metaKey)', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = 'cmd send'
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, shiftKey: false })
    expect(mockSend).toHaveBeenCalledWith('cmd send', undefined)
  })

  it('should not send on Ctrl+Enter during IME composition', () => {
    render(<ChatInput />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Message input')
    textarea.value = '你好'
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true, shiftKey: false, isComposing: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should abort on Esc when streaming', () => {
    activeSessionId.value = 'test-session'
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockAbort).toHaveBeenCalled()
  })

  it('should not abort on Esc when already aborting', () => {
    activeSessionId.value = 'test-session'
    runStates.value = { 'test-session': { streaming: true, aborting: true, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockAbort).not.toHaveBeenCalled()
  })

  it('should not abort on Esc when not streaming', () => {
    activeSessionId.value = 'test-session'
    runStates.value = {}
    render(<ChatInput />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockAbort).not.toHaveBeenCalled()
  })

  it('should not abort on Esc during IME composition', () => {
    activeSessionId.value = 'test-session'
    runStates.value = { 'test-session': { streaming: true, aborting: false, runId: 'r1', output: '', reasoning: '', reasoningDone: false, tools: [], agentEvents: [], approval: null, clarify: null, error: null } }
    render(<ChatInput />)
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true })
    expect(mockAbort).not.toHaveBeenCalled()
  })
})
