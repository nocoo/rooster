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
import type { Message } from '../types.js'

export const streaming = signal(false)
export const aborting = signal(false)
export const currentRunId = signal<string | null>(null)
export const streamOutput = signal('')
export const reasoningText = signal('')
export const reasoningDone = signal(false)
export const toolEvents = signal<ToolEvent[]>([])
export const chatError = signal<string | null>(null)

export const isWorking = computed(() => streaming.value || aborting.value)

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
  chatError.value = null
  streamOutput.value = ''
  reasoningText.value = ''
  reasoningDone.value = false
  toolEvents.value = []

  const payload: Record<string, string> = { input, session_id: sessionId }
  if (opts?.model) payload['model'] = opts.model
  if (opts?.profile) payload['profile'] = opts.profile
  if (opts?.provider) payload['provider'] = opts.provider

  sendRun(payload as Parameters<typeof sendRun>[0])
}

export function abort(): void {
  const sessionId = activeSessionId.value
  if (!sessionId || !streaming.value) return
  aborting.value = true
  sendAbort(sessionId)
}

function isActiveSession(sessionId: string): boolean {
  return sessionId === activeSessionId.value
}

function handleRunStarted(payload: RunStartedPayload): void {
  if (!isActiveSession(payload.session_id)) return
  currentRunId.value = payload.run_id
}

function handleMessageDelta(payload: MessageDeltaPayload): void {
  if (!isActiveSession(payload.session_id)) return
  streamOutput.value = payload.output
}

function handleRunCompleted(payload: RunCompletedPayload): void {
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
  streamOutput.value = ''
  reasoningText.value = ''
  reasoningDone.value = false
  toolEvents.value = []

  void loadSessions()
}

function handleRunFailed(payload: RunFailedPayload): void {
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
  streamOutput.value = ''
}

function handleToolStarted(payload: ToolStartedPayload): void {
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

function handleAbortCompleted(_payload: AbortCompletedPayload): void {
  streaming.value = false
  aborting.value = false
  currentRunId.value = null
}

function handleReasoningDelta(payload: ReasoningDeltaPayload): void {
  if (!isActiveSession(payload.session_id)) return
  reasoningText.value += payload.text
}

function handleThinkingDelta(payload: ThinkingDeltaPayload): void {
  if (!isActiveSession(payload.session_id)) return
  reasoningText.value += payload.text
}

function handleReasoningAvailable(payload: ReasoningAvailablePayload): void {
  if (!isActiveSession(payload.session_id)) return
  reasoningDone.value = true
}

function handleAgentEvent(_payload: AgentEventPayload): void {
  // Reserved for future status display
}

function handleResumed(payload: ResumedPayload): void {
  if (!isActiveSession(payload.session_id)) return

  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    messages.value = payload.messages as Message[]
  }

  streaming.value = payload.isWorking
  aborting.value = payload.isAborting
}
