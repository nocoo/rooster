import type { AgentBridgeClient, AgentBridgeOutput } from '../agent-bridge.js'
import type { MessageStore } from '../message-store.js'
import type { SessionStore } from '../session-store.js'
import type { RunPayload } from './types.js'

export interface BridgeRunDeps {
  bridge: AgentBridgeClient
  sessionStore: SessionStore
  messageStore: MessageStore
}

export interface RunEmitter {
  emit(event: string, payload: Record<string, unknown>): void
}

export interface BridgeRunResult {
  run_id: string
  session_id: string
  output: string
  error?: string | null | undefined
}

export interface RunStartedInfo {
  run_id: string
  session_id: string
}

export async function executeBridgeRun(
  deps: BridgeRunDeps,
  payload: RunPayload,
  emitter: RunEmitter,
  signal: AbortSignal,
  onStarted?: (info: RunStartedInfo) => void,
): Promise<BridgeRunResult> {
  const { bridge, sessionStore, messageStore } = deps

  const sessionId = payload.session_id ?? crypto.randomUUID()
  ensureSession(sessionStore, sessionId, payload)

  const priorMessages = messageStore.list(sessionId)

  messageStore.append({
    session_id: sessionId,
    role: 'user',
    content: payload.input,
  })

  const chatOptions: Record<string, unknown> = { wait: false }
  if (payload.profile) chatOptions['profile'] = payload.profile
  if (payload.model) chatOptions['model'] = payload.model
  if (payload.provider) chatOptions['provider'] = payload.provider
  if (payload.source) chatOptions['source'] = payload.source
  if (payload.instructions) chatOptions['instructions'] = payload.instructions
  if (priorMessages.length > 0) {
    chatOptions['conversation_history'] = priorMessages.map((m) => ({
      role: m.role,
      content: m.content ?? '',
    }))
  }

  const chatStarted = await bridge.chat(sessionId, payload.input, chatOptions)

  const runId = chatStarted.run_id

  onStarted?.({ run_id: runId, session_id: sessionId })

  emitter.emit('run.started', {
    event: 'run.started',
    session_id: sessionId,
    run_id: runId,
    queue_length: 0,
  })

  let cursor = 0
  let eventCursor = 0
  let output = ''

  while (!signal.aborted) {
    const chunk: AgentBridgeOutput = await bridge.getOutput(runId, cursor, eventCursor)

    if (chunk.delta) {
      output = chunk.output
      emitter.emit('message.delta', {
        event: 'message.delta',
        session_id: sessionId,
        run_id: runId,
        delta: chunk.delta,
        output: chunk.output,
      })
    }

    for (const evt of chunk.events) {
      emitBridgeEvent(emitter, sessionId, runId, evt)
    }

    cursor = chunk.cursor
    eventCursor = chunk.event_cursor

    if (chunk.done) {
      output = chunk.output || output

      const terminalError = detectTerminalError(chunk)

      if (terminalError) {
        emitter.emit('run.failed', {
          event: 'run.failed',
          session_id: sessionId,
          run_id: runId,
          error: terminalError,
          output,
        })
      } else {
        messageStore.append({
          session_id: sessionId,
          role: 'assistant',
          content: output,
        })
        sessionStore.updateLastActive(sessionId)

        emitter.emit('run.completed', {
          event: 'run.completed',
          session_id: sessionId,
          run_id: runId,
          output,
          result: chunk.result ?? null,
          error: null,
        })
      }

      return { run_id: runId, session_id: sessionId, output, error: terminalError ?? chunk.error }
    }

    await delay(100)
  }

  return { run_id: runId, session_id: sessionId, output, error: 'aborted' }
}

function summarizeArgs(args: unknown): string {
  if (!args) return ''
  const str = typeof args === 'string' ? args : JSON.stringify(args)
  return str.length > 120 ? str.slice(0, 117) + '...' : str
}

function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return JSON.stringify(value)
}

function emitBridgeEvent(
  emitter: RunEmitter,
  sessionId: string,
  runId: string,
  evt: Record<string, unknown>,
): void {
  const type = str(evt['event']) || str(evt['type'])
  if (!type) return

  if (type === 'tool.started') {
    const toolName = str(evt['tool_name']) || str(evt['tool']) || str(evt['name'])
    const rawArgs = evt['args'] ?? evt['arguments'] ?? {}
    const argsStr = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs)
    const preview = str(evt['preview']) || str(evt['result_preview']) || summarizeArgs(rawArgs)
    emitter.emit('tool.started', {
      event: 'tool.started',
      session_id: sessionId,
      run_id: runId,
      tool_call_id: evt['tool_call_id'] ?? `tc_${Date.now().toString(36)}`,
      tool: toolName,
      name: toolName,
      arguments: argsStr,
      preview,
    })
  } else if (type === 'tool.completed') {
    const toolName = str(evt['tool_name']) || str(evt['tool']) || str(evt['name'])
    const output = str(evt['output']) || str(evt['result']) || str(evt['result_preview'])
    const hasError = Boolean(evt['error'] || evt['is_error'])
    emitter.emit('tool.completed', {
      event: 'tool.completed',
      session_id: sessionId,
      run_id: runId,
      tool_call_id: evt['tool_call_id'] ?? '',
      tool: toolName,
      name: toolName,
      output,
      duration: typeof evt['duration'] === 'number' ? evt['duration'] : undefined,
      error: hasError ? str(evt['error']) || str(evt['is_error']) : undefined,
    })
  } else if (type === 'reasoning.delta' || type === 'thinking.delta') {
    emitter.emit(type, {
      event: type,
      session_id: sessionId,
      run_id: runId,
      text: str(evt['text']),
    })
  } else if (type === 'reasoning.available') {
    emitter.emit('reasoning.available', {
      event: 'reasoning.available',
      session_id: sessionId,
      run_id: runId,
    })
  } else {
    emitter.emit('agent.event', { ...evt, event: 'agent.event', type, session_id: sessionId, run_id: runId })
  }
}

function detectTerminalError(chunk: AgentBridgeOutput): string | null {
  if (chunk.status === 'error') {
    return typeof chunk.error === 'string' ? chunk.error : 'Agent run failed'
  }
  const result = chunk.result && typeof chunk.result === 'object' && !Array.isArray(chunk.result)
    ? chunk.result as Record<string, unknown>
    : null
  if (result?.failed === true || result?.completed === false) {
    const msg = result['error'] ?? result['message']
    return typeof msg === 'string' ? msg : 'Agent reported failure'
  }
  return null
}

function ensureSession(store: SessionStore, sessionId: string, payload: RunPayload): void {
  const existing = store.get(sessionId)
  if (!existing) {
    const input: Record<string, string> = { id: sessionId }
    if (payload.profile) input['profile'] = payload.profile
    if (payload.model) input['model'] = payload.model
    if (payload.provider) input['provider'] = payload.provider
    if (payload.source) input['source'] = payload.source
    store.create(input)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
