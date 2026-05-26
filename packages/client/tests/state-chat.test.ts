import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  streaming,
  streamingSessionId,
  aborting,
  currentRunId,
  streamOutput,
  reasoningText,
  reasoningDone,
  toolEvents,
  agentEvents,
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
const mockRoute = vi.fn()

vi.mock('../src/ws/chat.js', () => ({
  connect: (...args: unknown[]) => mockConnect(...args) as unknown,
  setHandlers: (...args: unknown[]) => mockSetHandlers(...args) as unknown,
  sendRun: (...args: unknown[]) => mockSendRun(...args) as unknown,
  sendAbort: (...args: unknown[]) => mockSendAbort(...args) as unknown,
}))

vi.mock('preact-router', () => ({
  route: (...args: unknown[]) => mockRoute(...args) as unknown,
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
    streamingSessionId.value = null
    aborting.value = false
    currentRunId.value = null
    streamOutput.value = ''
    reasoningText.value = ''
    reasoningDone.value = false
    toolEvents.value = []
    agentEvents.value = []
    chatError.value = null
    activeSessionId.value = null
    sessions.value = []
    sessionsTotal.value = 0
    messages.value = []
    mockSendRun.mockClear()
    mockSendAbort.mockClear()
    mockSetHandlers.mockClear()
    mockConnect.mockClear()
    mockRoute.mockClear()
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
      expect(typeof handlers['onThinkingDelta']).toBe('function')
      expect(typeof handlers['onReasoningAvailable']).toBe('function')
      expect(typeof handlers['onAgentEvent']).toBe('function')
      expect(typeof handlers['onResumed']).toBe('function')
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

    it('should navigate to new session', () => {
      send('hello')
      const sessionId = activeSessionId.value
      expect(sessionId).toBeTruthy()
      expect(mockRoute).toHaveBeenCalledWith(`/session/${sessionId as string}`)
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
      streamingSessionId.value = 's1'
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

    it('should not abort without streaming session', () => {
      streaming.value = true
      streamingSessionId.value = null
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
      onThinkingDelta: Handler
      onReasoningAvailable: Handler
      onAgentEvent: Handler
      onResumed: Handler
    }

    function getHandlers(): Handlers {
      initChat()
      const call = mockSetHandlers.mock.calls[0] as [Handlers]
      return call[0]
    }

    it('handleRunStarted should set currentRunId', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onRunStarted']({ event: 'run.started', session_id: 's1', run_id: 'r1', queue_length: 0 })
      expect(currentRunId.value).toBe('r1')
    })

    it('handleRunStarted should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onRunStarted']({ event: 'run.started', session_id: 'other', run_id: 'r1', queue_length: 0 })
      expect(currentRunId.value).toBeNull()
    })

    it('handleMessageDelta should update streamOutput', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onMessageDelta']({ event: 'message.delta', session_id: 's1', run_id: 'r1', delta: 'hi', output: 'hello' })
      expect(streamOutput.value).toBe('hello')
    })

    it('handleMessageDelta should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onMessageDelta']({ event: 'message.delta', session_id: 'other', run_id: 'r1', delta: 'hi', output: 'hello' })
      expect(streamOutput.value).toBe('')
    })

    it('handleRunCompleted should add assistant message and reset state', () => {
      activeSessionId.value = 's1'
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

    it('handleRunCompleted should use streamOutput when payload.output is empty', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      streaming.value = true
      streamOutput.value = 'accumulated content'
      h['onRunCompleted']({ event: 'run.completed', session_id: 's1', run_id: 'r1', output: '' })
      expect(messages.value[0]?.content).toBe('accumulated content')
    })

    it('handleRunFailed should set error and preserve partial output', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      streaming.value = true
      streamOutput.value = 'partial answer'
      h['onRunFailed']({ event: 'run.failed', session_id: 's1', error: 'something broke' })
      expect(chatError.value).toBe('something broke')
      expect(streaming.value).toBe(false)
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0]?.content).toBe('partial answer')
    })

    it('handleRunFailed should not add message if no partial output', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      streaming.value = true
      h['onRunFailed']({ event: 'run.failed', session_id: 's1', error: 'fail' })
      expect(chatError.value).toBe('fail')
      expect(messages.value).toHaveLength(0)
    })

    it('handleToolStarted should add tool event', () => {
      activeSessionId.value = 's1'
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
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onToolStarted']({
        event: 'tool.started', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc2', tool: 'write_file', name: 'write_file', arguments: '{}', preview: 'file.txt',
      })
      expect(toolEvents.value[0]?.preview).toBe('file.txt')
    })

    it('handleToolStarted should omit optional fields when absent', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onToolStarted']({
        event: 'tool.started', session_id: 's1', run_id: 'r1',
        tool_call_id: 'tc3', tool: 'bash', name: 'bash', arguments: '',
      })
      expect(toolEvents.value[0]?.arguments).toBeUndefined()
      expect(toolEvents.value[0]?.preview).toBeUndefined()
    })

    it('handleToolCompleted should update matching tool event', () => {
      activeSessionId.value = 's1'
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
      activeSessionId.value = 's1'
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
      activeSessionId.value = 's1'
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
      activeSessionId.value = 's1'
      const h = getHandlers()
      streaming.value = true
      aborting.value = true
      currentRunId.value = 'r1'
      h['onAbortCompleted']({ event: 'abort.completed', session_id: 's1', run_id: 'r1', synced: true })
      expect(streaming.value).toBe(false)
      expect(aborting.value).toBe(false)
      expect(currentRunId.value).toBeNull()
    })

    it('handleAbortCompleted should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      streaming.value = true
      aborting.value = true
      currentRunId.value = 'r1'
      h['onAbortCompleted']({ event: 'abort.completed', session_id: 'other', run_id: 'r1', synced: true })
      expect(streaming.value).toBe(true)
      expect(aborting.value).toBe(true)
      expect(currentRunId.value).toBe('r1')
    })

    it('handleReasoningDelta should append text', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 's1', run_id: 'r1', text: 'think' })
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 's1', run_id: 'r1', text: 'ing' })
      expect(reasoningText.value).toBe('thinking')
    })

    it('handleReasoningDelta should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 'other', run_id: 'r1', text: 'nope' })
      expect(reasoningText.value).toBe('')
    })

    it('handleThinkingDelta should append to same reasoningText', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onThinkingDelta']({ event: 'thinking.delta', session_id: 's1', run_id: 'r1', text: 'hmm ' })
      h['onReasoningDelta']({ event: 'reasoning.delta', session_id: 's1', run_id: 'r1', text: 'ok' })
      expect(reasoningText.value).toBe('hmm ok')
    })

    it('handleThinkingDelta should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onThinkingDelta']({ event: 'thinking.delta', session_id: 'other', run_id: 'r1', text: 'nope' })
      expect(reasoningText.value).toBe('')
    })

    it('handleReasoningAvailable should set reasoningDone', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onReasoningAvailable']({ event: 'reasoning.available', session_id: 's1', run_id: 'r1' })
      expect(reasoningDone.value).toBe(true)
    })

    it('handleReasoningAvailable should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onReasoningAvailable']({ event: 'reasoning.available', session_id: 'other', run_id: 'r1' })
      expect(reasoningDone.value).toBe(false)
    })

    it('handleAgentEvent should add status to agentEvents', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onAgentEvent']({
        event: 'agent.event', session_id: 's1', run_id: 'r1', type: 'status',
        profile: 'default', model: 'claude-4', provider: 'anthropic', tool_count: 30,
      })
      expect(agentEvents.value).toHaveLength(1)
      expect(agentEvents.value[0]?.type).toBe('status')
      expect(agentEvents.value[0]?.profile).toBe('default')
      expect(agentEvents.value[0]?.model).toBe('claude-4')
      expect(agentEvents.value[0]?.provider).toBe('anthropic')
      expect(agentEvents.value[0]?.tool_count).toBe(30)
    })

    it('handleAgentEvent should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onAgentEvent']({
        event: 'agent.event', session_id: 'other', run_id: 'r1', type: 'status',
      })
      expect(agentEvents.value).toHaveLength(0)
    })

    it('handleAgentEvent should handle minimal payload without optional fields', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onAgentEvent']({
        event: 'agent.event', session_id: 's1', run_id: 'r1', type: 'unknown_event',
      })
      expect(agentEvents.value).toHaveLength(1)
      expect(agentEvents.value[0]?.type).toBe('unknown_event')
      expect(agentEvents.value[0]?.profile).toBeUndefined()
    })

    it('handleResumed should restore messages and working state', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onResumed']({
        event: 'resumed',
        session_id: 's1',
        messages: [
          { id: 'm1', session_id: 's1', role: 'user', content: 'hi', timestamp: '2025-01-01' },
          { id: 'm2', session_id: 's1', role: 'assistant', content: 'hello', timestamp: '2025-01-01' },
        ],
        isWorking: true,
        isAborting: false,
        events: [],
      })
      expect(messages.value).toHaveLength(2)
      expect(streaming.value).toBe(true)
      expect(aborting.value).toBe(false)
    })

    it('handleResumed should ignore different session', () => {
      activeSessionId.value = 's1'
      const h = getHandlers()
      h['onResumed']({
        event: 'resumed',
        session_id: 'other',
        messages: [{ id: 'm1', session_id: 'other', role: 'user', content: 'hi', timestamp: '2025-01-01' }],
        isWorking: true,
        isAborting: false,
        events: [],
      })
      expect(messages.value).toHaveLength(0)
      expect(streaming.value).toBe(false)
    })

    it('handleResumed should not overwrite messages if payload has empty array', () => {
      activeSessionId.value = 's1'
      messages.value = [{ id: 'm1', session_id: 's1', role: 'user', content: 'existing', timestamp: '2025-01-01' }]
      const h = getHandlers()
      h['onResumed']({
        event: 'resumed',
        session_id: 's1',
        messages: [],
        isWorking: false,
        isAborting: false,
        events: [],
      })
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0]?.content).toBe('existing')
    })

    describe('full event sequence simulation', () => {
      it('should handle agent.event → thinking → tool → message → completed', () => {
        activeSessionId.value = 's1'
        const h = getHandlers()

        h['onRunStarted']({ event: 'run.started', session_id: 's1', run_id: 'r1', queue_length: 0 })
        expect(currentRunId.value).toBe('r1')

        h['onAgentEvent']({
          event: 'agent.event', session_id: 's1', run_id: 'r1', type: 'status',
          profile: 'coding', model: 'claude-4', provider: 'anthropic', tool_count: 25,
        })
        expect(agentEvents.value).toHaveLength(1)

        h['onThinkingDelta']({ event: 'thinking.delta', session_id: 's1', run_id: 'r1', text: 'Let me think...' })
        expect(reasoningText.value).toBe('Let me think...')

        h['onToolStarted']({
          event: 'tool.started', session_id: 's1', run_id: 'r1',
          tool_call_id: 'tc1', tool: 'Bash', name: 'Bash', arguments: '{"command":"ls"}',
        })
        expect(toolEvents.value).toHaveLength(1)

        h['onToolCompleted']({
          event: 'tool.completed', session_id: 's1', run_id: 'r1',
          tool_call_id: 'tc1', tool: 'Bash', name: 'Bash', output: 'src\npackage.json', duration: 50,
        })
        expect(toolEvents.value[0]?.status).toBe('completed')

        h['onMessageDelta']({ event: 'message.delta', session_id: 's1', run_id: 'r1', delta: 'Here', output: 'Here' })
        h['onMessageDelta']({ event: 'message.delta', session_id: 's1', run_id: 'r1', delta: ' are files.', output: 'Here are files.' })
        expect(streamOutput.value).toBe('Here are files.')

        h['onRunCompleted']({ event: 'run.completed', session_id: 's1', run_id: 'r1', output: 'Here are files.' })
        expect(messages.value).toHaveLength(1)
        expect(messages.value[0]?.content).toBe('Here are files.')
        expect(streaming.value).toBe(false)
        expect(toolEvents.value).toHaveLength(0)
        expect(agentEvents.value).toHaveLength(0)
        expect(reasoningText.value).toBe('')
      })

      it('should not pollute current session with other session events', () => {
        activeSessionId.value = 's1'
        const h = getHandlers()
        streaming.value = true

        h['onMessageDelta']({ event: 'message.delta', session_id: 'other', run_id: 'r2', delta: 'x', output: 'x' })
        expect(streamOutput.value).toBe('')

        h['onToolStarted']({
          event: 'tool.started', session_id: 'other', run_id: 'r2',
          tool_call_id: 'tc-x', tool: 'Bash', name: 'Bash', arguments: '{}',
        })
        expect(toolEvents.value).toHaveLength(0)

        h['onAgentEvent']({
          event: 'agent.event', session_id: 'other', run_id: 'r2', type: 'status',
        })
        expect(agentEvents.value).toHaveLength(0)

        h['onRunCompleted']({ event: 'run.completed', session_id: 'other', run_id: 'r2', output: 'other output' })
        expect(streaming.value).toBe(true)
        expect(messages.value).toHaveLength(0)
      })
    })
  })
})
