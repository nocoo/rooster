import type { Server, Socket } from 'socket.io'
import type { AgentBridgeClient } from '../agent-bridge.js'
import type { SessionStore } from '../session-store.js'
import type { MessageStore } from '../message-store.js'
import { executeBridgeRun } from './bridge-run.js'
import type { RunEmitter } from './bridge-run.js'
import { executeAbort } from './abort.js'
import type { AbortPayload, ResumePayload, RunPayload } from './types.js'

export interface ChatRunDeps {
  bridge: AgentBridgeClient
  sessionStore: SessionStore
  messageStore: MessageStore
}

interface ActiveRun {
  runId: string
  sessionId: string
  abortController: AbortController
}

export function registerChatRunNamespace(io: Server, deps: ChatRunDeps): void {
  const ns = io.of('/chat-run')

  ns.on('connection', (socket: Socket) => {
    let activeRun: ActiveRun | null = null

    const emitter: RunEmitter = {
      emit(event: string, payload: Record<string, unknown>) {
        socket.emit(event, payload)
      },
    }

    socket.on('run', (payload: RunPayload) => {
      const abortController = new AbortController()

      void (async () => {
        try {
          await executeBridgeRun(deps, payload, emitter, abortController.signal, (info) => {
            activeRun = {
              runId: info.run_id,
              sessionId: info.session_id,
              abortController,
            }
          })
        } catch (err: unknown) {
          const sessionId = payload.session_id ?? ''
          const error = err instanceof Error ? err.message : 'Unknown error'
          socket.emit('run.failed', {
            event: 'run.failed',
            session_id: sessionId,
            error,
          })
        } finally {
          activeRun = null
        }
      })()
    })

    socket.on('abort', (_payload: AbortPayload) => {
      if (!activeRun) return

      void executeAbort(
        deps.bridge,
        activeRun.sessionId,
        activeRun.runId,
        emitter,
        activeRun.abortController,
      )
    })

    socket.on('resume', (payload: ResumePayload) => {
      const session = deps.sessionStore.get(payload.session_id)
      if (!session) {
        socket.emit('run.failed', {
          event: 'run.failed',
          session_id: payload.session_id,
          error: 'Session not found',
        })
        return
      }

      const messages = deps.messageStore.list(payload.session_id)

      socket.emit('resumed', {
        event: 'resumed',
        session_id: payload.session_id,
        messages,
        isWorking: false,
        isAborting: false,
        events: [],
      })
    })

    socket.on('disconnect', () => {
      if (activeRun) {
        activeRun.abortController.abort()
        activeRun = null
      }
    })
  })
}
