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

export interface ReasoningDeltaPayload {
  event: 'reasoning.delta'
  session_id: string
  run_id: string
  text: string
}

export type ChatEventHandler = {
  onRunStarted?: (payload: RunStartedPayload) => void
  onMessageDelta?: (payload: MessageDeltaPayload) => void
  onRunCompleted?: (payload: RunCompletedPayload) => void
  onRunFailed?: (payload: RunFailedPayload) => void
  onToolStarted?: (payload: ToolStartedPayload) => void
  onToolCompleted?: (payload: ToolCompletedPayload) => void
  onAbortCompleted?: (payload: AbortCompletedPayload) => void
  onReasoningDelta?: (payload: ReasoningDeltaPayload) => void
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
  socket.on('abort.completed', (d: AbortCompletedPayload) => { handlers.onAbortCompleted?.(d) })
  socket.on('reasoning.delta', (d: ReasoningDeltaPayload) => { handlers.onReasoningDelta?.(d) })
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
}): void {
  socket?.emit('run', payload)
}

export function sendAbort(sessionId: string): void {
  socket?.emit('abort', { session_id: sessionId })
}

export function sendResume(sessionId: string): void {
  socket?.emit('resume', { session_id: sessionId })
}

export function getSocket(): Socket | null {
  return socket
}
