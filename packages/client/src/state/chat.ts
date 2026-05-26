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

export const streaming = signal(false)
export const streamingSessionId = signal<string | null>(null)
export const aborting = signal(false)
export const currentRunId = signal<string | null>(null)
export const streamOutput = signal('')
export const reasoningText = signal('')
export const reasoningDone = signal(false)
export const toolEvents = signal<ToolEvent[]>([])
export const agentEvents = signal<AgentStatus[]>([])
export const chatError = signal<string | null>(null)

export const isWorking = computed(() => streaming.value || aborting.value)
export const isStreamingHere = computed(() => streaming.value && streamingSessionId.value === activeSessionId.value)

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

  streaming.value = true
  streamingSessionId.value = sessionId
  chatError.value = null
  streamOutput.value = ''
  reasoningText.value = ''
  reasoningDone.value = false
  toolEvents.value = []
  agentEvents.value = []

  const payload: Record<string, string> = { input, session_id: sessionId }
  if (opts?.model) payload['model'] = opts.model
  if (opts?.profile) payload['profile'] = opts.profile
  if (opts?.provider) payload['provider'] = opts.provider

  sendRun(payload as Parameters<typeof sendRun>[0])
}

export function abort(): void {
  const sessionId = streamingSessionId.value
  if (!sessionId || !streaming.value) return
  aborting.value = true
  sendAbort(sessionId)
}

function isActiveSession(sessionId: string): boolean {
  return sessionId === activeSessionId.value
}

function handleRunStarted(payload: RunStartedPayload): void {
  pushDebugEvent('run.started', payload)
  if (!isActiveSession(payload.session_id)) return
  currentRunId.value = payload.run_id
}

function handleMessageDelta(payload: MessageDeltaPayload): void {
  pushDebugEvent('message.delta', payload)
  if (!isActiveSession(payload.session_id)) return
  streamOutput.value = payload.output
}

function handleRunCompleted(payload: RunCompletedPayload): void {
  pushDebugEvent('run.completed', payload)
  if (!isActiveSession(payload.session_id)) return

  const finalOutput = payload.output || streamOutput.value

  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    session_id: payload.session_id,
    role: 'assistant',
    content: finalOutput,
    timestamp: new Date().toISOString(),
  }
  messages.value = [...messages.value, assistantMessage]

  streaming.value = false
  aborting.value = false
  currentRunId.value = null
  streamingSessionId.value = null
  streamOutput.value = ''
  reasoningText.value = ''
  reasoningDone.value = false
  toolEvents.value = []
  agentEvents.value = []

  void loadSessions()
}

function handleRunFailed(payload: RunFailedPayload): void {
  pushDebugEvent('run.failed', payload)
  if (!isActiveSession(payload.session_id)) return
  chatError.value = payload.error

  if (streamOutput.value) {
    const partialMessage: Message = {
      id: crypto.randomUUID(),
      session_id: payload.session_id,
      role: 'assistant',
      content: streamOutput.value,
      timestamp: new Date().toISOString(),
    }
    messages.value = [...messages.value, partialMessage]
  }

  streaming.value = false
  aborting.value = false
  currentRunId.value = null
  streamingSessionId.value = null
  streamOutput.value = ''
}

function handleToolStarted(payload: ToolStartedPayload): void {
  pushDebugEvent('tool.started', payload)
  if (!isActiveSession(payload.session_id)) return
  const evt: ToolEvent = {
    tool_call_id: payload.tool_call_id,
    name: payload.name,
    status: 'started',
    ...(payload.arguments ? { arguments: payload.arguments } : {}),
    ...(payload.preview ? { preview: payload.preview } : {}),
  }
  toolEvents.value = [...toolEvents.value, evt]
}

function handleToolCompleted(payload: ToolCompletedPayload): void {
  pushDebugEvent('tool.completed', payload)
  if (!isActiveSession(payload.session_id)) return
  toolEvents.value = toolEvents.value.map((t) =>
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
}

function handleAbortCompleted(payload: AbortCompletedPayload): void {
  pushDebugEvent('abort.completed', payload)
  if (!isActiveSession(payload.session_id)) return
  streaming.value = false
  aborting.value = false
  currentRunId.value = null
  streamingSessionId.value = null
}

function handleReasoningDelta(payload: ReasoningDeltaPayload): void {
  pushDebugEvent('reasoning.delta', payload)
  if (!isActiveSession(payload.session_id)) return
  reasoningText.value += payload.text
}

function handleThinkingDelta(payload: ThinkingDeltaPayload): void {
  pushDebugEvent('thinking.delta', payload)
  if (!isActiveSession(payload.session_id)) return
  reasoningText.value += payload.text
}

function handleReasoningAvailable(payload: ReasoningAvailablePayload): void {
  pushDebugEvent('reasoning.available', payload)
  if (!isActiveSession(payload.session_id)) return
  reasoningDone.value = true
}

function handleAgentEvent(payload: AgentEventPayload): void {
  pushDebugEvent('agent.event', payload)
  if (!isActiveSession(payload.session_id)) return
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
  agentEvents.value = [...agentEvents.value, status]
}

function handleResumed(payload: ResumedPayload): void {
  pushDebugEvent('resumed', payload)
  if (!isActiveSession(payload.session_id)) return

  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    messages.value = payload.messages as Message[]
  }

  streaming.value = payload.isWorking
  aborting.value = payload.isAborting
}
