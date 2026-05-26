import { signal, computed } from '@preact/signals'
import { route } from 'preact-router'
import {
  connect,
  setHandlers,
  sendRun,
  sendAbort,
  type ToolEvent,
  type RunStartedPayload,
  type MessageDeltaPayload,
  type RunCompletedPayload,
  type RunFailedPayload,
  type ToolStartedPayload,
  type ToolCompletedPayload,
  type AbortCompletedPayload,
  type ReasoningDeltaPayload,
  type ThinkingDeltaPayload,
  type ReasoningAvailablePayload,
  type AgentEventPayload,
  type ResumedPayload,
} from '../ws/chat.js'
import { sessions, sessionsTotal, activeSessionId, messages, loadSessions } from './sessions.js'
import { pushDebugEvent } from './debug.js'
import type { Message } from '../types.js'

export interface AgentStatus {
  type: string
  profile?: string
  model?: string
  provider?: string
  tool_count?: number
  [key: string]: unknown
}

export interface RunState {
  streaming: boolean
  aborting: boolean
  runId: string | null
  output: string
  reasoning: string
  reasoningDone: boolean
  tools: ToolEvent[]
  agentEvents: AgentStatus[]
  error: string | null
}

function createRunState(): RunState {
  return {
    streaming: false,
    aborting: false,
    runId: null,
    output: '',
    reasoning: '',
    reasoningDone: false,
    tools: [],
    agentEvents: [],
    error: null,
  }
}

export const runStates = signal<Record<string, RunState>>({})

function getState(sessionId: string): RunState {
  return runStates.value[sessionId] ?? createRunState()
}

function setState(sessionId: string, patch: Partial<RunState>): void {
  const current = getState(sessionId)
  runStates.value = { ...runStates.value, [sessionId]: { ...current, ...patch } }
}

function clearState(sessionId: string): void {
  const entries = Object.entries(runStates.value).filter(([key]) => key !== sessionId)
  runStates.value = Object.fromEntries(entries)
}

export const activeRunState = computed<RunState>(() => {
  const sid = activeSessionId.value
  if (!sid) return createRunState()
  return getState(sid)
})

export const streaming = computed(() => activeRunState.value.streaming)
export const aborting = computed(() => activeRunState.value.aborting)
export const currentRunId = computed(() => activeRunState.value.runId)
export const streamOutput = computed(() => activeRunState.value.output)
export const reasoningText = computed(() => activeRunState.value.reasoning)
export const reasoningDone = computed(() => activeRunState.value.reasoningDone)
export const toolEvents = computed(() => activeRunState.value.tools)
export const agentEvents = computed(() => activeRunState.value.agentEvents)
export const chatError = computed(() => activeRunState.value.error)

export const isWorking = computed(() => streaming.value || aborting.value)
export const isStreamingHere = computed(() => streaming.value)

export function initChat(): void {
  setHandlers({
    onRunStarted: handleRunStarted,
    onMessageDelta: handleMessageDelta,
    onRunCompleted: handleRunCompleted,
    onRunFailed: handleRunFailed,
    onToolStarted: handleToolStarted,
    onToolCompleted: handleToolCompleted,
    onAbortCompleted: handleAbortCompleted,
    onReasoningDelta: handleReasoningDelta,
    onThinkingDelta: handleThinkingDelta,
    onReasoningAvailable: handleReasoningAvailable,
    onAgentEvent: handleAgentEvent,
    onResumed: handleResumed,
  })
  connect()
}

export function send(input: string, opts?: { model?: string; profile?: string; provider?: string }): void {
  const sessionId = activeSessionId.value ?? crypto.randomUUID()

  if (!activeSessionId.value) {
    activeSessionId.value = sessionId
    sessions.value = [
      { id: sessionId, started_at: new Date().toISOString(), last_active: new Date().toISOString() },
      ...sessions.value,
    ]
    sessionsTotal.value += 1
    route(`/session/${sessionId}`)
  }

  const userMessage: Message = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    role: 'user',
    content: input,
    timestamp: new Date().toISOString(),
  }
  messages.value = [...messages.value, userMessage]

  setState(sessionId, {
    streaming: true,
    aborting: false,
    error: null,
    output: '',
    reasoning: '',
    reasoningDone: false,
    tools: [],
    agentEvents: [],
  })

  const payload: Record<string, string> = { input, session_id: sessionId }
  if (opts?.model) payload['model'] = opts.model
  if (opts?.profile) payload['profile'] = opts.profile
  if (opts?.provider) payload['provider'] = opts.provider

  sendRun(payload as Parameters<typeof sendRun>[0])
}

export function abort(): void {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const state = getState(sessionId)
  if (!state.streaming) return
  setState(sessionId, { aborting: true })
  sendAbort(sessionId)
}

function handleRunStarted(payload: RunStartedPayload): void {
  pushDebugEvent('run.started', payload)
  setState(payload.session_id, { runId: payload.run_id })
}

function handleMessageDelta(payload: MessageDeltaPayload): void {
  pushDebugEvent('message.delta', payload)
  setState(payload.session_id, { output: payload.output })
}

function handleRunCompleted(payload: RunCompletedPayload): void {
  pushDebugEvent('run.completed', payload)
  const state = getState(payload.session_id)
  const finalOutput = payload.output || state.output

  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    session_id: payload.session_id,
    role: 'assistant',
    content: finalOutput,
    timestamp: new Date().toISOString(),
  }

  if (payload.session_id === activeSessionId.value) {
    messages.value = [...messages.value, assistantMessage]
  }

  clearState(payload.session_id)
  void loadSessions()
}

function handleRunFailed(payload: RunFailedPayload): void {
  pushDebugEvent('run.failed', payload)
  const state = getState(payload.session_id)

  if (state.output && payload.session_id === activeSessionId.value) {
    const partialMessage: Message = {
      id: crypto.randomUUID(),
      session_id: payload.session_id,
      role: 'assistant',
      content: state.output,
      timestamp: new Date().toISOString(),
    }
    messages.value = [...messages.value, partialMessage]
  }

  clearState(payload.session_id)
  if (payload.session_id === activeSessionId.value) {
    setState(payload.session_id, { error: payload.error })
  }
}

function handleToolStarted(payload: ToolStartedPayload): void {
  pushDebugEvent('tool.started', payload)
  const state = getState(payload.session_id)
  const evt: ToolEvent = {
    tool_call_id: payload.tool_call_id,
    name: payload.name,
    status: 'started',
    ...(payload.arguments ? { arguments: payload.arguments } : {}),
    ...(payload.preview ? { preview: payload.preview } : {}),
  }
  setState(payload.session_id, { tools: [...state.tools, evt] })
}

function handleToolCompleted(payload: ToolCompletedPayload): void {
  pushDebugEvent('tool.completed', payload)
  const state = getState(payload.session_id)
  const tools = state.tools.map((t) =>
    t.tool_call_id === payload.tool_call_id
      ? {
          ...t,
          output: payload.output,
          status: 'completed' as const,
          ...(payload.duration != null ? { duration: payload.duration } : {}),
          ...(payload.error ? { error: payload.error } : {}),
        }
      : t,
  )
  setState(payload.session_id, { tools })
}

function handleAbortCompleted(payload: AbortCompletedPayload): void {
  pushDebugEvent('abort.completed', payload)
  clearState(payload.session_id)
}

function handleReasoningDelta(payload: ReasoningDeltaPayload): void {
  pushDebugEvent('reasoning.delta', payload)
  const state = getState(payload.session_id)
  setState(payload.session_id, { reasoning: state.reasoning + payload.text })
}

function handleThinkingDelta(payload: ThinkingDeltaPayload): void {
  pushDebugEvent('thinking.delta', payload)
  const state = getState(payload.session_id)
  setState(payload.session_id, { reasoning: state.reasoning + payload.text })
}

function handleReasoningAvailable(payload: ReasoningAvailablePayload): void {
  pushDebugEvent('reasoning.available', payload)
  setState(payload.session_id, { reasoningDone: true })
}

function handleAgentEvent(payload: AgentEventPayload): void {
  pushDebugEvent('agent.event', payload)
  const state = getState(payload.session_id)
  const profile = payload['profile']
  const model = payload['model']
  const provider = payload['provider']
  const toolCount = payload['tool_count']
  const status: AgentStatus = {
    type: payload.type,
    ...(typeof profile === 'string' ? { profile } : {}),
    ...(typeof model === 'string' ? { model } : {}),
    ...(typeof provider === 'string' ? { provider } : {}),
    ...(typeof toolCount === 'number' ? { tool_count: toolCount } : {}),
  }
  setState(payload.session_id, { agentEvents: [...state.agentEvents, status] })
}

function handleResumed(payload: ResumedPayload): void {
  pushDebugEvent('resumed', payload)
  if (payload.session_id !== activeSessionId.value) return

  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    messages.value = payload.messages as Message[]
  }

  setState(payload.session_id, {
    streaming: payload.isWorking,
    aborting: payload.isAborting,
  })
}
