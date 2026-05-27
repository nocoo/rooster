import type { Server, Socket } from 'socket.io'
import type { AgentBridgeClient } from '../agent-bridge.js'
import type { AttachmentStore } from '../attachment-store.js'
import type { SessionStore } from '../session-store.js'
import type { MessageStore } from '../message-store.js'
import { executeBridgeRun } from './bridge-run.js'
import type { RunEmitter } from './bridge-run.js'
import { executeAbort } from './abort.js'
import type { AbortPayload, ApprovalRespondPayload, ClarifyRespondPayload, ResumePayload, RunPayload } from './types.js'

export interface ChatRunDeps {
  bridge: AgentBridgeClient
  sessionStore: SessionStore
  messageStore: MessageStore
  attachmentStore?: AttachmentStore
  uploadsDir?: string
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

    socket.on('abort', (payload: AbortPayload) => {
      if (!activeRun || activeRun.sessionId !== payload.session_id) {
        socket.emit('abort.completed', {
          event: 'abort.completed',
          session_id: payload.session_id,
          run_id: '',
          synced: false,
          error: 'No active run for this session',
        })
        return
      }

      const { sessionId, runId, abortController } = activeRun

      void (async () => {
        try {
          await executeAbort(deps.bridge, sessionId, runId, emitter, abortController)
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          socket.emit('abort.completed', {
            event: 'abort.completed',
            session_id: sessionId,
            run_id: runId,
            synced: false,
            error,
          })
        }
      })()
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
      const runForSession = activeRun !== null && activeRun.sessionId === payload.session_id ? activeRun : null
      const isWorking = runForSession !== null
      const isAborting = runForSession !== null && runForSession.abortController.signal.aborted

      socket.emit('resumed', {
        event: 'resumed',
        session_id: payload.session_id,
        messages,
        isWorking,
        isAborting,
        events: [],
      })
    })

    socket.on('approval.respond', (payload: ApprovalRespondPayload) => {
      if (!activeRun || activeRun.sessionId !== payload.session_id) {
        socket.emit('run.failed', {
          event: 'run.failed',
          session_id: payload.session_id,
          error: 'No active run for this session',
        })
        return
      }

      const { runId } = activeRun

      void (async () => {
        try {
          await deps.bridge.approvalRespond(payload.approval_id, payload.choice)
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : 'Approval respond failed'
          socket.emit('run.failed', {
            event: 'run.failed',
            session_id: payload.session_id,
            run_id: runId,
            error,
          })
        }
      })()
    })

    socket.on('clarify.respond', (payload: ClarifyRespondPayload) => {
      if (!activeRun || activeRun.sessionId !== payload.session_id) {
        socket.emit('run.failed', {
          event: 'run.failed',
          session_id: payload.session_id,
          error: 'No active run for this session',
        })
        return
      }

      const { runId } = activeRun

      void (async () => {
        try {
          await deps.bridge.clarifyRespond(payload.clarify_id, payload.response)
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : 'Clarify respond failed'
          socket.emit('run.failed', {
            event: 'run.failed',
            session_id: payload.session_id,
            run_id: runId,
            error,
          })
        }
      })()
    })

    socket.on('disconnect', () => {
      if (activeRun) {
        activeRun.abortController.abort()
        activeRun = null
      }
    })
  })
}
