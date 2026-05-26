import { io, type Socket } from 'socket.io-client'
import { signal } from '@preact/signals'

export const connected = signal(false)

export interface ToolEvent {
  tool_call_id: string
  name: string
  arguments?: string
  preview?: string
  output?: string
  duration?: number
  error?: string
  status: 'started' | 'completed'
}

export interface RunStartedPayload {
  event: 'run.started'
  session_id: string
  run_id: string
  queue_length: number
}

export interface MessageDeltaPayload {
  event: 'message.delta'
  session_id: string
  run_id: string
  delta: string
  output: string
}

export interface RunCompletedPayload {
  event: 'run.completed'
  session_id: string
  run_id: string
  output: string
  result?: unknown
  error?: string | null
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
}

export interface RunFailedPayload {
  event: 'run.failed'
  session_id: string
  run_id?: string
  error: string
  output?: string
}

export interface ToolStartedPayload {
  event: 'tool.started'
  session_id: string
  run_id: string
  tool_call_id: string
  tool: string
  name: string
  arguments: string
  preview?: string
}

export interface ToolCompletedPayload {
  event: 'tool.completed'
  session_id: string
  run_id: string
  tool_call_id: string
  tool: string
  name: string
  output: string
  duration?: number
  error?: string
}

export interface AbortCompletedPayload {
  event: 'abort.completed'
  session_id: string
  run_id: string
  synced: boolean
  error?: string
}

export interface AbortStartedPayload {
  event: 'abort.started'
  session_id: string
  run_id: string
  graceMs: number
}

export interface ReasoningDeltaPayload {
  event: 'reasoning.delta'
  session_id: string
  run_id: string
  text: string
}

export interface ThinkingDeltaPayload {
  event: 'thinking.delta'
  session_id: string
  run_id: string
  text: string
}

export interface ReasoningAvailablePayload {
  event: 'reasoning.available'
  session_id: string
  run_id: string
}

export interface AgentEventPayload {
  event: 'agent.event'
  session_id: string
  run_id: string
  type: string
  [key: string]: unknown
}

export interface ApprovalRequestedPayload {
  event: 'approval.requested'
  session_id: string
  run_id: string
  approval_id: string
  command: string
  description?: string
  choices: string[]
  allow_permanent?: boolean
  timeout_ms?: number
}

export interface ApprovalResolvedPayload {
  event: 'approval.resolved'
  session_id: string
  run_id?: string
  approval_id: string
  choice: string
}

export interface ClarifyRequestedPayload {
  event: 'clarify.requested'
  session_id: string
  run_id: string
  clarify_id: string
  question: string
  choices?: string[]
  timeout_ms?: number
}

export interface ClarifyResolvedPayload {
  event: 'clarify.resolved'
  session_id: string
  run_id?: string
  clarify_id: string
}

export interface CompressionStartedPayload {
  event: 'compression.started'
  session_id: string
  run_id: string
  request_id?: string
  message_count?: number
  token_count?: number
  source?: string
}

export interface CompressionCompletedPayload {
  event: 'compression.completed'
  session_id: string
  run_id: string
  request_id?: string
  compressed?: boolean
  totalMessages?: number
  resultMessages?: number
  beforeTokens?: number
  afterTokens?: number
  contextTokens?: number
  summaryTokens?: number
}

export interface ResumedPayload {
  event: 'resumed'
  session_id: string
  messages: unknown[]
  isWorking: boolean
  isAborting: boolean
  events: unknown[]
}

export type ChatEventHandler = {
  onRunStarted?: (payload: RunStartedPayload) => void
  onMessageDelta?: (payload: MessageDeltaPayload) => void
  onRunCompleted?: (payload: RunCompletedPayload) => void
  onRunFailed?: (payload: RunFailedPayload) => void
  onToolStarted?: (payload: ToolStartedPayload) => void
  onToolCompleted?: (payload: ToolCompletedPayload) => void
  onAbortStarted?: (payload: AbortStartedPayload) => void
  onAbortCompleted?: (payload: AbortCompletedPayload) => void
  onReasoningDelta?: (payload: ReasoningDeltaPayload) => void
  onThinkingDelta?: (payload: ThinkingDeltaPayload) => void
  onReasoningAvailable?: (payload: ReasoningAvailablePayload) => void
  onAgentEvent?: (payload: AgentEventPayload) => void
  onApprovalRequested?: (payload: ApprovalRequestedPayload) => void
  onApprovalResolved?: (payload: ApprovalResolvedPayload) => void
  onClarifyRequested?: (payload: ClarifyRequestedPayload) => void
  onClarifyResolved?: (payload: ClarifyResolvedPayload) => void
  onCompressionStarted?: (payload: CompressionStartedPayload) => void
  onCompressionCompleted?: (payload: CompressionCompletedPayload) => void
  onResumed?: (payload: ResumedPayload) => void
}

let socket: Socket | null = null
let handlers: ChatEventHandler = {}

export function setHandlers(h: ChatEventHandler): void {
  handlers = h
}

export function connect(): void {
  if (socket) return

  socket = io('/chat-run', { transports: ['websocket'] })

  socket.on('connect', () => { connected.value = true })
  socket.on('disconnect', () => { connected.value = false })

  socket.on('run.started', (d: RunStartedPayload) => { handlers.onRunStarted?.(d) })
  socket.on('message.delta', (d: MessageDeltaPayload) => { handlers.onMessageDelta?.(d) })
  socket.on('run.completed', (d: RunCompletedPayload) => { handlers.onRunCompleted?.(d) })
  socket.on('run.failed', (d: RunFailedPayload) => { handlers.onRunFailed?.(d) })
  socket.on('tool.started', (d: ToolStartedPayload) => { handlers.onToolStarted?.(d) })
  socket.on('tool.completed', (d: ToolCompletedPayload) => { handlers.onToolCompleted?.(d) })
  socket.on('abort.started', (d: AbortStartedPayload) => { handlers.onAbortStarted?.(d) })
  socket.on('abort.completed', (d: AbortCompletedPayload) => { handlers.onAbortCompleted?.(d) })
  socket.on('reasoning.delta', (d: ReasoningDeltaPayload) => { handlers.onReasoningDelta?.(d) })
  socket.on('thinking.delta', (d: ThinkingDeltaPayload) => { handlers.onThinkingDelta?.(d) })
  socket.on('reasoning.available', (d: ReasoningAvailablePayload) => { handlers.onReasoningAvailable?.(d) })
  socket.on('agent.event', (d: AgentEventPayload) => { handlers.onAgentEvent?.(d) })
  socket.on('approval.requested', (d: ApprovalRequestedPayload) => { handlers.onApprovalRequested?.(d) })
  socket.on('approval.resolved', (d: ApprovalResolvedPayload) => { handlers.onApprovalResolved?.(d) })
  socket.on('clarify.requested', (d: ClarifyRequestedPayload) => { handlers.onClarifyRequested?.(d) })
  socket.on('clarify.resolved', (d: ClarifyResolvedPayload) => { handlers.onClarifyResolved?.(d) })
  socket.on('compression.started', (d: CompressionStartedPayload) => { handlers.onCompressionStarted?.(d) })
  socket.on('compression.completed', (d: CompressionCompletedPayload) => { handlers.onCompressionCompleted?.(d) })
  socket.on('resumed', (d: ResumedPayload) => { handlers.onResumed?.(d) })
}

export function disconnect(): void {
  socket?.disconnect()
  socket = null
  connected.value = false
}

export function sendRun(payload: {
  input: string
  session_id: string
  model?: string
  profile?: string
  provider?: string
  instructions?: string
  source?: string
  attachments?: Array<{ id: string; original_name: string; mime_type: string; size: number }>
}): void {
  socket?.emit('run', payload)
}

export function sendAbort(sessionId: string): void {
  socket?.emit('abort', { session_id: sessionId })
}

export function sendResume(sessionId: string): void {
  socket?.emit('resume', { session_id: sessionId })
}

export function sendApprovalRespond(sessionId: string, approvalId: string, choice: string): void {
  socket?.emit('approval.respond', { session_id: sessionId, approval_id: approvalId, choice })
}

export function sendClarifyRespond(sessionId: string, clarifyId: string, response: string): void {
  socket?.emit('clarify.respond', { session_id: sessionId, clarify_id: clarifyId, response })
}

export function getSocket(): Socket | null {
  return socket
}
