import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockSocket = {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  _trigger: (event: string, ...args: unknown[]) => void
  _listeners: Map<string, Array<(...args: unknown[]) => void>>
}

const mockSocket = vi.hoisted((): MockSocket => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? []
      existing.push(handler)
      listeners.set(event, existing)
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event)
      if (handlers) handlers.forEach((h) => { h(...args) })
    },
    _listeners: listeners,
  }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

import { connected, connect, disconnect, sendRun, sendAbort, sendResume, setHandlers, getSocket } from '../src/ws/chat.js'

describe('ws/chat', () => {
  beforeEach(() => {
    mockSocket._listeners.clear()
    mockSocket.emit.mockClear()
    mockSocket.disconnect.mockClear()
    connected.value = false
    disconnect()
  })

  describe('connect', () => {
    it('should create socket and register listeners', () => {
      connect()
      expect(mockSocket._listeners.has('connect')).toBe(true)
      expect(mockSocket._listeners.has('disconnect')).toBe(true)
      expect(mockSocket._listeners.has('run.started')).toBe(true)
      expect(mockSocket._listeners.has('message.delta')).toBe(true)
      expect(mockSocket._listeners.has('run.completed')).toBe(true)
      expect(mockSocket._listeners.has('thinking.delta')).toBe(true)
      expect(mockSocket._listeners.has('reasoning.available')).toBe(true)
      expect(mockSocket._listeners.has('agent.event')).toBe(true)
      expect(mockSocket._listeners.has('resumed')).toBe(true)
    })

    it('should set connected signal on connect/disconnect events', () => {
      connect()
      mockSocket._trigger('connect')
      expect(connected.value).toBe(true)
      mockSocket._trigger('disconnect')
      expect(connected.value).toBe(false)
    })

    it('should not create duplicate sockets', () => {
      connect()
      connect()
      expect(getSocket()).toBeTruthy()
    })
  })

  describe('event handlers', () => {
    it('should call registered handler on run.started', () => {
      const onRunStarted = vi.fn()
      setHandlers({ onRunStarted })
      connect()
      mockSocket._trigger('run.started', { event: 'run.started', session_id: 's1', run_id: 'r1', queue_length: 0 })
      expect(onRunStarted).toHaveBeenCalledWith({ event: 'run.started', session_id: 's1', run_id: 'r1', queue_length: 0 })
    })

    it('should call registered handler on message.delta', () => {
      const onMessageDelta = vi.fn()
      setHandlers({ onMessageDelta })
      connect()
      mockSocket._trigger('message.delta', { event: 'message.delta', session_id: 's1', run_id: 'r1', delta: 'hi', output: 'hi' })
      expect(onMessageDelta).toHaveBeenCalled()
    })

    it('should call registered handler on run.completed', () => {
      const onRunCompleted = vi.fn()
      setHandlers({ onRunCompleted })
      connect()
      mockSocket._trigger('run.completed', { event: 'run.completed', session_id: 's1', run_id: 'r1', output: 'done' })
      expect(onRunCompleted).toHaveBeenCalled()
    })

    it('should call registered handler on run.failed', () => {
      const onRunFailed = vi.fn()
      setHandlers({ onRunFailed })
      connect()
      mockSocket._trigger('run.failed', { event: 'run.failed', session_id: 's1', error: 'fail' })
      expect(onRunFailed).toHaveBeenCalled()
    })

    it('should call registered handler on tool events', () => {
      const onToolStarted = vi.fn()
      const onToolCompleted = vi.fn()
      setHandlers({ onToolStarted, onToolCompleted })
      connect()
      mockSocket._trigger('tool.started', { event: 'tool.started', tool_call_id: 'tc1', name: 'read_file' })
      mockSocket._trigger('tool.completed', { event: 'tool.completed', tool_call_id: 'tc1', name: 'read_file', output: 'data' })
      expect(onToolStarted).toHaveBeenCalled()
      expect(onToolCompleted).toHaveBeenCalled()
    })

    it('should call handler on reasoning.delta', () => {
      const onReasoningDelta = vi.fn()
      setHandlers({ onReasoningDelta })
      connect()
      mockSocket._trigger('reasoning.delta', { event: 'reasoning.delta', run_id: 'r1', text: 'thinking' })
      expect(onReasoningDelta).toHaveBeenCalled()
    })

    it('should call handler on thinking.delta', () => {
      const onThinkingDelta = vi.fn()
      setHandlers({ onThinkingDelta })
      connect()
      mockSocket._trigger('thinking.delta', { event: 'thinking.delta', run_id: 'r1', text: 'hmm' })
      expect(onThinkingDelta).toHaveBeenCalledWith({ event: 'thinking.delta', run_id: 'r1', text: 'hmm' })
    })

    it('should call handler on reasoning.available', () => {
      const onReasoningAvailable = vi.fn()
      setHandlers({ onReasoningAvailable })
      connect()
      mockSocket._trigger('reasoning.available', { event: 'reasoning.available', run_id: 'r1' })
      expect(onReasoningAvailable).toHaveBeenCalled()
    })

    it('should call handler on agent.event', () => {
      const onAgentEvent = vi.fn()
      setHandlers({ onAgentEvent })
      connect()
      mockSocket._trigger('agent.event', { event: 'agent.event', run_id: 'r1', type: 'status' })
      expect(onAgentEvent).toHaveBeenCalled()
    })

    it('should call handler on resumed', () => {
      const onResumed = vi.fn()
      setHandlers({ onResumed })
      connect()
      mockSocket._trigger('resumed', { event: 'resumed', session_id: 's1', messages: [], isWorking: false, isAborting: false, events: [] })
      expect(onResumed).toHaveBeenCalled()
    })

    it('should call handler on abort.completed', () => {
      const onAbortCompleted = vi.fn()
      setHandlers({ onAbortCompleted })
      connect()
      mockSocket._trigger('abort.completed', { event: 'abort.completed', run_id: 'r1', synced: true })
      expect(onAbortCompleted).toHaveBeenCalled()
    })
  })

  describe('sendRun', () => {
    it('should emit run event', () => {
      connect()
      sendRun({ input: 'hello', session_id: 's1' })
      expect(mockSocket.emit).toHaveBeenCalledWith('run', { input: 'hello', session_id: 's1' })
    })
  })

  describe('sendAbort', () => {
    it('should emit abort event', () => {
      connect()
      sendAbort('s1')
      expect(mockSocket.emit).toHaveBeenCalledWith('abort', { session_id: 's1' })
    })
  })

  describe('sendResume', () => {
    it('should emit resume event', () => {
      connect()
      sendResume('s1')
      expect(mockSocket.emit).toHaveBeenCalledWith('resume', { session_id: 's1' })
    })
  })

  describe('disconnect', () => {
    it('should set connected to false', () => {
      connect()
      connected.value = true
      disconnect()
      expect(connected.value).toBe(false)
      expect(getSocket()).toBeNull()
    })
  })
})
