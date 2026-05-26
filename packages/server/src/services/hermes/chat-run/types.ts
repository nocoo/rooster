export interface AttachmentRef {
  id: string
  original_name: string
  mime_type: string
  size: number
}

export interface RunPayload {
  input: string
  session_id?: string
  display_input?: string
  display_role?: string
  storage_message?: boolean
  model?: string
  provider?: string
  profile?: string
  instructions?: string
  model_groups?: string[]
  queue_id?: string
  source?: string
  attachments?: AttachmentRef[]
}

export interface AbortPayload {
  session_id: string
}

export interface ResumePayload {
  session_id: string
}

export interface RunStartedEvent {
  event: 'run.started'
  session_id: string
  run_id: string
  queue_length: number
}

export interface RunCompletedEvent {
  event: 'run.completed'
  session_id: string
  run_id: string
  output: string
  result?: unknown
  error?: string | null
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
  queue_remaining?: number
}

export interface RunFailedEvent {
  event: 'run.failed'
  session_id: string
  run_id?: string
  error: string
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
  queue_remaining?: number
}

export interface MessageDeltaEvent {
  event: 'message.delta'
  session_id: string
  run_id: string
  delta: string
  output: string
}

export interface ToolStartedEvent {
  event: 'tool.started'
  session_id: string
  run_id: string
  tool_call_id: string
  tool: string
  name: string
  arguments: string
  preview?: string
}

export interface ToolCompletedEvent {
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

export interface ReasoningDeltaEvent {
  event: 'reasoning.delta'
  session_id: string
  run_id: string
  text: string
}

export interface AbortStartedEvent {
  event: 'abort.started'
  session_id: string
  run_id: string
  graceMs: number
}

export interface AbortCompletedEvent {
  event: 'abort.completed'
  session_id: string
  run_id: string
  synced: boolean
  queue_length?: number
}

export interface ResumedEvent {
  event: 'resumed'
  session_id: string
  messages: unknown[]
  isWorking: boolean
  isAborting: boolean
  events: unknown[]
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
  queueLength?: number
  queueMessages?: unknown[]
}

export interface ApprovalRequestedEvent {
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

export interface ApprovalResolvedEvent {
  event: 'approval.resolved'
  session_id: string
  run_id?: string
  approval_id: string
  choice: string
}

export interface ClarifyRequestedEvent {
  event: 'clarify.requested'
  session_id: string
  run_id: string
  clarify_id: string
  question: string
  choices?: string[]
  timeout_ms?: number
}

export interface ClarifyResolvedEvent {
  event: 'clarify.resolved'
  session_id: string
  run_id?: string
  clarify_id: string
}

export interface ApprovalRespondPayload {
  session_id: string
  approval_id: string
  choice: string
}

export interface ClarifyRespondPayload {
  session_id: string
  clarify_id: string
  response: string
}

export type ChatRunServerEvent =
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | MessageDeltaEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ReasoningDeltaEvent
  | AbortStartedEvent
  | AbortCompletedEvent
  | ResumedEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | ClarifyRequestedEvent
  | ClarifyResolvedEvent
