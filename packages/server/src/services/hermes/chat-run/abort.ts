import type { AgentBridgeClient } from '../agent-bridge.js'
import type { RunEmitter } from './bridge-run.js'

export async function executeAbort(
  bridge: AgentBridgeClient,
  sessionId: string,
  runId: string,
  emitter: RunEmitter,
  abortController: AbortController,
): Promise<void> {
  emitter.emit('abort.started', {
    event: 'abort.started',
    session_id: sessionId,
    run_id: runId,
    graceMs: 5000,
  })

  abortController.abort()
  await bridge.interrupt(sessionId)

  emitter.emit('abort.completed', {
    event: 'abort.completed',
    session_id: sessionId,
    run_id: runId,
    synced: true,
  })
}
