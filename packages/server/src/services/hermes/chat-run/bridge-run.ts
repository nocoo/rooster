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
      output = chunk.output

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
        error: chunk.error ?? null,
      })

      return { run_id: runId, session_id: sessionId, output, error: chunk.error }
    }

    await delay(100)
  }

  return { run_id: runId, session_id: sessionId, output, error: 'aborted' }
}

function emitBridgeEvent(
  emitter: RunEmitter,
  sessionId: string,
  runId: string,
  evt: Record<string, unknown>,
): void {
  const type = evt['type'] as string | undefined
  if (!type) return

  if (type === 'tool.started' || type === 'tool.completed') {
    emitter.emit(type, { ...evt, event: type, session_id: sessionId, run_id: runId })
  } else if (type === 'reasoning.delta' || type === 'reasoning.available') {
    emitter.emit(type, { ...evt, event: type, session_id: sessionId, run_id: runId })
  } else {
    emitter.emit('agent.event', { ...evt, event: 'agent.event', session_id: sessionId, run_id: runId })
  }
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
