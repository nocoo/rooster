import { signal, computed } from '@preact/signals'
import { route } from 'preact-router'
import {
  connect,
  setHandlers,
  sendRun,
  sendAbort,
  sendApprovalRespond,
  sendClarifyRespond,
  type ToolEvent,
  type RunStartedPayload,
  type MessageDeltaPayload,
  type RunCompletedPayload,
  type RunFailedPayload,
  type ToolStartedPayload,
  type ToolCompletedPayload,
  type AbortStartedPayload,
  type AbortCompletedPayload,
  type ReasoningDeltaPayload,
  type ThinkingDeltaPayload,
  type ReasoningAvailablePayload,
  type AgentEventPayload,
  type ApprovalRequestedPayload,
  type ApprovalResolvedPayload,
  type ClarifyRequestedPayload,
  type ClarifyResolvedPayload,
  type CompressionStartedPayload,
  type CompressionCompletedPayload,
  type ResumedPayload,
} from '../ws/chat.js'
import { sessions, sessionsTotal, activeSessionId, messages, loadSessions } from './sessions.js'
import { pushDebugEvent } from './debug.js'
import type { Message } from '../types.js'
import { uuid } from '../lib/uuid.js'

export interface AgentStatus {
  type: string
  profile?: string
  model?: string
  provider?: string
  tool_count?: number
  [key: string]: unknown
}

export interface PendingApproval {
  approval_id: string
  command: string
  description?: string
  choices: string[]
  allow_permanent?: boolean
  timeout_ms?: number
  responding?: boolean
}

export interface PendingClarify {
  clarify_id: string
  question: string
  choices?: string[]
  timeout_ms?: number
  responding?: boolean
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
  approval: PendingApproval | null
  clarify: PendingClarify | null
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
    approval: null,
    clarify: null,
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
export const pendingApproval = computed(() => activeRunState.value.approval)
export const pendingClarify = computed(() => activeRunState.value.clarify)
export const chatError = computed(() => activeRunState.value.error)

export const isWorking = computed(() => streaming.value || aborting.value)
export const isStreamingHere = computed(() => streaming.value)
export const anySessionWorking = computed(() =>
  Object.values(runStates.value).some((s) => s.streaming || s.aborting),
)

export interface CompressionState {
  status: 'compressing' | 'completed'
  request_id?: string
  message_count?: number
  token_count?: number
  source?: string
  compressed?: boolean
  totalMessages?: number
  resultMessages?: number
  beforeTokens?: number
  afterTokens?: number
  contextTokens?: number
  summaryTokens?: number
}

export const compressionStates = signal<Record<string, CompressionState>>({})

export const activeCompressionState = computed<CompressionState | null>(() => {
  const sid = activeSessionId.value
  if (!sid) return null
  return compressionStates.value[sid] ?? null
})

export function initChat(): void {
  setHandlers({
    onRunStarted: handleRunStarted,
    onMessageDelta: handleMessageDelta,
    onRunCompleted: handleRunCompleted,
    onRunFailed: handleRunFailed,
    onToolStarted: handleToolStarted,
    onToolCompleted: handleToolCompleted,
    onAbortStarted: handleAbortStarted,
    onAbortCompleted: handleAbortCompleted,
    onReasoningDelta: handleReasoningDelta,
    onThinkingDelta: handleThinkingDelta,
    onReasoningAvailable: handleReasoningAvailable,
    onAgentEvent: handleAgentEvent,
    onApprovalRequested: handleApprovalRequested,
    onApprovalResolved: handleApprovalResolved,
    onClarifyRequested: handleClarifyRequested,
    onClarifyResolved: handleClarifyResolved,
    onCompressionStarted: handleCompressionStarted,
    onCompressionCompleted: handleCompressionCompleted,
    onResumed: handleResumed,
  })
  connect()
}

export function send(input: string, opts?: { model?: string; profile?: string; provider?: string; attachments?: Array<{ id: string; original_name: string; mime_type: string; size: number }> }): void {
  if (anySessionWorking.value) return
  const sessionId = activeSessionId.value ?? uuid()

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
    id: uuid(),
    session_id: sessionId,
    role: 'user',
    content: input,
    timestamp: new Date().toISOString(),
    ...(opts?.attachments && opts.attachments.length > 0 ? { attachments: opts.attachments } : {}),
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
    approval: null,
    clarify: null,
  })

  const payload: Record<string, unknown> = { input, session_id: sessionId }
  if (opts?.model) payload['model'] = opts.model
  if (opts?.profile) payload['profile'] = opts.profile
  if (opts?.provider) payload['provider'] = opts.provider
  if (opts?.attachments && opts.attachments.length > 0) payload['attachments'] = opts.attachments

  sendRun(payload as Parameters<typeof sendRun>[0])
}

export function abort(): void {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const state = getState(sessionId)
  if (!state.streaming || state.aborting) return
  setState(sessionId, { aborting: true })
  sendAbort(sessionId)
}

export function respondApproval(choice: string): void {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const state = getState(sessionId)
  if (!state.approval) return
  setState(sessionId, { approval: { ...state.approval, responding: true } })
  sendApprovalRespond(sessionId, state.approval.approval_id, choice)
}

export function respondClarify(response: string): void {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const state = getState(sessionId)
  if (!state.clarify) return
  setState(sessionId, { clarify: { ...state.clarify, responding: true } })
  sendClarifyRespond(sessionId, state.clarify.clarify_id, response)
}

function handleRunStarted(payload: RunStartedPayload): void {
  pushDebugEvent('run.started', payload)
  const entries = Object.entries(compressionStates.value).filter(([key]) => key !== payload.session_id)
  compressionStates.value = Object.fromEntries(entries)
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
    id: uuid(),
    session_id: payload.session_id,
    role: 'assistant',
    content: finalOutput,
    ...(state.reasoning ? { reasoning: state.reasoning } : {}),
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
      id: uuid(),
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

function handleAbortStarted(payload: AbortStartedPayload): void {
  pushDebugEvent('abort.started', payload)
  setState(payload.session_id, { aborting: true })
}

function handleAbortCompleted(payload: AbortCompletedPayload): void {
  pushDebugEvent('abort.completed', payload)
  const state = getState(payload.session_id)

  if (state.output && payload.session_id === activeSessionId.value) {
    const partialMessage: Message = {
      id: uuid(),
      session_id: payload.session_id,
      role: 'assistant',
      content: state.output,
      ...(state.reasoning ? { reasoning: state.reasoning } : {}),
      timestamp: new Date().toISOString(),
    }
    messages.value = [...messages.value, partialMessage]
  }

  clearState(payload.session_id)

  if (!payload.synced && payload.error) {
    setState(payload.session_id, { error: payload.error })
  }
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

function handleApprovalRequested(payload: ApprovalRequestedPayload): void {
  pushDebugEvent('approval.requested', payload)
  setState(payload.session_id, {
    approval: {
      approval_id: payload.approval_id,
      command: payload.command,
      choices: payload.choices,
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.allow_permanent != null ? { allow_permanent: payload.allow_permanent } : {}),
      ...(payload.timeout_ms != null ? { timeout_ms: payload.timeout_ms } : {}),
    },
  })
}

function handleApprovalResolved(payload: ApprovalResolvedPayload): void {
  pushDebugEvent('approval.resolved', payload)
  setState(payload.session_id, { approval: null })
}

function handleClarifyRequested(payload: ClarifyRequestedPayload): void {
  pushDebugEvent('clarify.requested', payload)
  setState(payload.session_id, {
    clarify: {
      clarify_id: payload.clarify_id,
      question: payload.question,
      ...(payload.choices ? { choices: payload.choices } : {}),
      ...(payload.timeout_ms != null ? { timeout_ms: payload.timeout_ms } : {}),
    },
  })
}

function handleClarifyResolved(payload: ClarifyResolvedPayload): void {
  pushDebugEvent('clarify.resolved', payload)
  setState(payload.session_id, { clarify: null })
}

function handleCompressionStarted(payload: CompressionStartedPayload): void {
  pushDebugEvent('compression.started', payload)
  compressionStates.value = {
    ...compressionStates.value,
    [payload.session_id]: {
      status: 'compressing',
      ...(payload.request_id ? { request_id: payload.request_id } : {}),
      ...(payload.message_count != null ? { message_count: payload.message_count } : {}),
      ...(payload.token_count != null ? { token_count: payload.token_count } : {}),
      ...(payload.source ? { source: payload.source } : {}),
    },
  }
}

function handleCompressionCompleted(payload: CompressionCompletedPayload): void {
  pushDebugEvent('compression.completed', payload)
  compressionStates.value = {
    ...compressionStates.value,
    [payload.session_id]: {
      status: 'completed',
      ...(payload.request_id ? { request_id: payload.request_id } : {}),
      ...(payload.source ? { source: payload.source } : {}),
      ...(payload.compressed != null ? { compressed: payload.compressed } : {}),
      ...(payload.totalMessages != null ? { totalMessages: payload.totalMessages } : {}),
      ...(payload.resultMessages != null ? { resultMessages: payload.resultMessages } : {}),
      ...(payload.beforeTokens != null ? { beforeTokens: payload.beforeTokens } : {}),
      ...(payload.afterTokens != null ? { afterTokens: payload.afterTokens } : {}),
      ...(payload.contextTokens != null ? { contextTokens: payload.contextTokens } : {}),
      ...(payload.summaryTokens != null ? { summaryTokens: payload.summaryTokens } : {}),
    },
  }
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
