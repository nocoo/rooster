import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  streaming,
  aborting,
  currentRunId,
  streamOutput,
  reasoningText,
  toolEvents,
  chatError,
  isWorking,
  initChat,
  send,
  abort,
} from '../src/state/chat.js'
import { sessions, sessionsTotal, activeSessionId, messages } from '../src/state/sessions.js'

const mockSendRun = vi.fn()
const mockSendAbort = vi.fn()
const mockSetHandlers = vi.fn()
const mockConnect = vi.fn()

vi.mock('../src/ws/chat.js', () => ({
  connect: (...args: unknown[]) => mockConnect(...args) as unknown,
  setHandlers: (...args: unknown[]) => mockSetHandlers(...args) as unknown,
  sendRun: (...args: unknown[]) => mockSendRun(...args) as unknown,
  sendAbort: (...args: unknown[]) => mockSendAbort(...args) as unknown,
}))

vi.mock('../src/api/sessions.js', () => ({
  fetchSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
  fetchMessages: vi.fn().mockResolvedValue({ messages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
}))

describe('state/chat', () => {
  beforeEach(() => {
    streaming.value = false
    aborting.value = false
    currentRunId.value = null
    streamOutput.value = ''
    reasoningText.value = ''
    toolEvents.value = []
    chatError.value = null
    activeSessionId.value = null
    sessions.value = []
    sessionsTotal.value = 0
    messages.value = []
    mockSendRun.mockClear()
    mockSendAbort.mockClear()
    mockSetHandlers.mockClear()
    mockConnect.mockClear()
  })

  describe('initChat', () => {
    it('should set handlers and connect', () => {
      initChat()
      const handlers = mockSetHandlers.mock.calls[0]?.[0] as Record<string, unknown>
      expect(handlers).toBeTruthy()
      expect(typeof handlers['onRunStarted']).toBe('function')
      expect(typeof handlers['onMessageDelta']).toBe('function')
      expect(typeof handlers['onRunCompleted']).toBe('function')
      expect(typeof handlers['onRunFailed']).toBe('function')
      expect(typeof handlers['onToolStarted']).toBe('function')
      expect(typeof handlers['onToolCompleted']).toBe('function')
      expect(typeof handlers['onAbortCompleted']).toBe('function')
      expect(typeof handlers['onReasoningDelta']).toBe('function')
      expect(mockConnect).toHaveBeenCalled()
    })
  })

  describe('isWorking', () => {
    it('should be true when streaming', () => {
      streaming.value = true
      expect(isWorking.value).toBe(true)
    })

    it('should be true when aborting', () => {
      aborting.value = true
      expect(isWorking.value).toBe(true)
    })

    it('should be false when idle', () => {
      expect(isWorking.value).toBe(false)
    })
  })

  describe('send', () => {
    it('should create new session if none active', () => {
      send('hello')
      expect(activeSessionId.value).toBeTruthy()
      expect(sessions.value).toHaveLength(1)
      expect(sessionsTotal.value).toBe(1)
    })

    it('should add user message optimistically', () => {
      send('hello')
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0]?.role).toBe('user')
      expect(messages.value[0]?.content).toBe('hello')
    })

    it('should set streaming state', () => {
      send('hello')
      expect(streaming.value).toBe(true)
      expect(chatError.value).toBeNull()
      expect(streamOutput.value).toBe('')
    })

    it('should call sendRun with session_id and input', () => {
      send('hello')
      const sessionId = activeSessionId.value
      expect(mockSendRun).toHaveBeenCalledWith({ input: 'hello', session_id: sessionId })
    })

    it('should pass model/profile/provider options', () => {
      send('hello', { model: 'gpt-4', profile: 'default', provider: 'openai' })
      expect(mockSendRun).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4',
        profile: 'default',
        provider: 'openai',
      }))
    })

    it('should reuse existing session', () => {
      activeSessionId.value = 'existing-session'
      send('hello')
      expect(activeSessionId.value).toBe('existing-session')
      expect(sessions.value).toHaveLength(0)
    })
  })

  describe('abort', () => {
    it('should call sendAbort when streaming', () => {
      activeSessionId.value = 's1'
      streaming.value = true
      abort()
      expect(aborting.value).toBe(true)
      expect(mockSendAbort).toHaveBeenCalledWith('s1')
    })

    it('should not abort when not streaming', () => {
      activeSessionId.value = 's1'
      abort()
      expect(aborting.value).toBe(false)
      expect(mockSendAbort).not.toHaveBeenCalled()
    })

    it('should not abort without active session', () => {
      streaming.value = true
      abort()
      expect(aborting.value).toBe(false)
      expect(mockSendAbort).not.toHaveBeenCalled()
    })
  })

  describe('event handlers', () => {
    type Handler = (...args: unknown[]) => void
    type Handlers = {
      onRunStarted: Handler
      onMessageDelta: Handler
      onRunCompleted: Handler
      onRunFailed: Handler
      onToolStarted: Handler
      onToolCompleted: Handler
      onAbortCompleted: Handler
      onReasoningDelta: Handler
    }

    function getHandlers(): Handlers {
      initChat()
      const call = mockSetHandlers.mock.calls[0] as [Handlers]
      return call[0]
    }

    it('handleRunStarted should set currentRunId', () => {
      const h = getHandlers()
      h['onRunStarted']({ event: 'run.started', session_id: 's1', run_id: 'r1', queue_length: 0 })
      expect(currentRunId.value).toBe('r1')
    })

    it('handleMessageDelta should update streamOutput', () => {
      const h = getHandlers()
      h['onMessageDelta']({ event: 'message.delta', session_id: 's1', run_id: 'r1', delta: 'hi', output: 'hello' })
      expect(streamOutput.value).toBe('hello')
    })

    it('handleRunCompleted should add assistant message and reset state', () => {
      const h = getHandlers()
      streaming.value = true
      currentRunId.value = 'r1'
      streamOutput.value = 'partial'
      h['onRunCompleted']({ event: 'run.completed', session_id: 's1', run_id: 'r1', output: 'done' })
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0]?.role).toBe('assistant')
      expect(messages.value[0]?.content).toBe('done')
      expect(streaming.value).toBe(false)
      expect(currentRunId.value).toBeNull()
      expect(streamOutput.value).toBe('')
    })

    it('handleRunFailed should set error and reset streaming', () => {
      const h = getHandlers()
      streaming.value = true
      h['onRunFailed']({ event: 'run.failed', session_id: 's1', error: 'something broke' })
      expect(chatError.value).toBe('something broke')
      expect(streaming.value).toBe(false)
    })

    it('handleToolStarted should add tool event', () => {
      const h = getHandlers()
      h['onToolStarted']({
        event: 'tool.started', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc1', tool: 'read_file', name: 'read_file', arguments: '{}',
      })
      expect(toolEvents.value).toHaveLength(1)
      expect(toolEvents.value[0]?.status).toBe('started')
      expect(toolEvents.value[0]?.name).toBe('read_file')
      expect(toolEvents.value[0]?.arguments).toBe('{}')
    })

    it('handleToolStarted should include preview when present', () => {
      const h = getHandlers()
      h['onToolStarted']({
        event: 'tool.started', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc2', tool: 'write_file', name: 'write_file', arguments: '{}', preview: 'file.txt',
      })
      expect(toolEvents.value[0]?.preview).toBe('file.txt')
    })

    it('handleToolStarted should omit optional fields when absent', () => {
      const h = getHandlers()
      h['onToolStarted']({
        event: 'tool.started', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc3', tool: 'bash', name: 'bash', arguments: '',
      })
      expect(toolEvents.value[0]?.arguments).toBeUndefined()
      expect(toolEvents.value[0]?.preview).toBeUndefined()
    })

    it('handleToolCompleted should update matching tool event', () => {
      const h = getHandlers()
      toolEvents.value = [{ tool_call_id: 'tc1', name: 'read_file', status: 'started' }]
      h['onToolCompleted']({
        event: 'tool.completed', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc1', tool: 'read_file', name: 'read_file', output: 'data', duration: 100,
      })
      expect(toolEvents.value[0]?.status).toBe('completed')
      expect(toolEvents.value[0]?.output).toBe('data')
      expect(toolEvents.value[0]?.duration).toBe(100)
    })

    it('handleToolCompleted should include error when present', () => {
      const h = getHandlers()
      toolEvents.value = [{ tool_call_id: 'tc1', name: 'read_file', status: 'started' }]
      h['onToolCompleted']({
        event: 'tool.completed', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc1', tool: 'read_file', name: 'read_file', output: '', error: 'not found',
      })
      expect(toolEvents.value[0]?.error).toBe('not found')
      expect(toolEvents.value[0]?.duration).toBeUndefined()
    })

    it('handleToolCompleted should not modify non-matching events', () => {
      const h = getHandlers()
      toolEvents.value = [
        { tool_call_id: 'tc1', name: 'read_file', status: 'started' },
        { tool_call_id: 'tc2', name: 'bash', status: 'started' },
      ]
      h['onToolCompleted']({
        event: 'tool.completed', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc1', tool: 'read_file', name: 'read_file', output: 'ok',
      })
      expect(toolEvents.value[1]?.status).toBe('started')
    })

    it('handleAbortCompleted should reset streaming state', () => {
      const h = getHandlers()
      streaming.value = true
      aborting.value = true
      currentRunId.value = 'r1'
      h['onAbortCompleted']({ event: 'abort.completed', session_id: 's1', run_id: 'r1', synced: true })
      expect(streaming.value).toBe(false)
      expect(aborting.value).toBe(false)
      expect(currentRunId.value).toBeNull()
    })

    it('handleReasoningDelta should append text', () => {
      const h = getHandlers()
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 's1', run_id: 'r1', text: 'think' })
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 's1', run_id: 'r1', text: 'ing' })
      expect(reasoningText.value).toBe('thinking')
    })
  })
})
