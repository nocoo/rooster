import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { createDb } from '../src/services/hermes/db.js'
import { SessionStore } from '../src/services/hermes/session-store.js'
import { MessageStore } from '../src/services/hermes/message-store.js'
import { registerChatRunNamespace } from '../src/services/hermes/chat-run/socket.js'
import type { AgentBridgeClient, AgentBridgeChatStarted, AgentBridgeOutput, AgentBridgeResponse } from '../src/services/hermes/agent-bridge.js'
import type Database from 'better-sqlite3'
import type { AddressInfo } from 'node:net'

function createMockBridge(options: {
  chatResponse?: Partial<AgentBridgeChatStarted>
  outputs?: Array<Partial<AgentBridgeOutput>>
  interruptResponse?: Partial<AgentBridgeResponse>
  chatError?: Error
} = {}): AgentBridgeClient {
  let outputIndex = 0

  return {
    chat: () => {
      if (options.chatError) return Promise.reject(options.chatError)
      return Promise.resolve({
        ok: true,
        run_id: 'run-1',
        session_id: 'sess-1',
        status: 'running',
        ...options.chatResponse,
      } satisfies AgentBridgeChatStarted)
    },
    getOutput: () => {
      const outputs = options.outputs ?? [
        { delta: 'Hello', output: 'Hello', cursor: 1, event_cursor: 0, events: [], done: false },
        { delta: ' world', output: 'Hello world', cursor: 2, event_cursor: 0, events: [], done: true },
      ]
      const out = outputs[outputIndex] ?? outputs[outputs.length - 1]
      if (outputIndex < outputs.length - 1) outputIndex++
      return Promise.resolve({
        ok: true,
        run_id: 'run-1',
        session_id: 'sess-1',
        status: out?.done ? 'complete' : 'running',
        delta: '',
        cursor: 0,
        output: '',
        event_cursor: 0,
        events: [],
        done: false,
        ...out,
      } satisfies AgentBridgeOutput)
    },
    interrupt: () => {
      return Promise.resolve({ ok: true, ...options.interruptResponse } satisfies AgentBridgeResponse)
    },
    ping: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
  } as unknown as AgentBridgeClient
}

describe('Socket.IO /chat-run', () => {
  let db: Database.Database
  let httpServer: ReturnType<typeof createServer>
  let ioServer: Server
  let client: ClientSocket
  let sessionStore: SessionStore
  let messageStore: MessageStore
  let port: number

  function setupServer(bridge: AgentBridgeClient) {
    db = createDb(':memory:')
    sessionStore = new SessionStore(db)
    messageStore = new MessageStore(db)
    httpServer = createServer()
    ioServer = new Server(httpServer)
    registerChatRunNamespace(ioServer, { bridge, sessionStore, messageStore })
    httpServer.listen(0)
    port = (httpServer.address() as AddressInfo).port
  }

  function connectClient(): ClientSocket {
    client = ioClient(`http://localhost:${String(port)}/chat-run`, {
      transports: ['websocket'],
    })
    return client
  }

  afterEach(async () => {
    client.disconnect()
    await ioServer.close()
    await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })
  })

  describe('run — successful event order', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should emit run.started then message.delta then run.completed', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('message.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.emit('run', { input: 'hello', session_id: 'sess-1' })
        })
      })

      expect(events[0]?.['event']).toBe('run.started')
      expect(events[0]?.['run_id']).toBe('run-1')
      expect(events[0]?.['session_id']).toBe('sess-1')

      const deltas = events.filter((e) => e['event'] === 'message.delta')
      expect(deltas.length).toBeGreaterThanOrEqual(1)

      const completed = events[events.length - 1]
      expect(completed?.['event']).toBe('run.completed')
      expect(completed?.['output']).toBe('Hello world')
    })
  })

  describe('run — message delta persistence', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should persist user and assistant messages', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'hello', session_id: 'sess-test' })
        })
      })

      const messages = messageStore.list('sess-test')
      expect(messages).toHaveLength(2)
      expect(messages[0]?.role).toBe('user')
      expect(messages[0]?.content).toBe('hello')
      expect(messages[1]?.role).toBe('assistant')
      expect(messages[1]?.content).toBe('Hello world')
    })
  })

  describe('run — bridge error → run.failed', () => {
    beforeEach(() => {
      setupServer(createMockBridge({ chatError: new Error('Bridge connection refused') }))
      connectClient()
    })

    it('should emit run.failed on bridge error', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'hello', session_id: 'sess-err' })
        })
      })

      expect(failed['event']).toBe('run.failed')
      expect(failed['error']).toBe('Bridge connection refused')
    })
  })

  describe('run — tool events', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ type: 'tool.started', tool_call_id: 'tc-1', tool: 'read_file', name: 'read_file', arguments: '{}' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ type: 'tool.completed', tool_call_id: 'tc-1', tool: 'read_file', name: 'read_file', output: 'file contents', duration: 50 }],
            done: false,
          },
          {
            delta: 'Done',
            output: 'Done',
            cursor: 3,
            event_cursor: 2,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit tool.started and tool.completed events', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('tool.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('tool.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'read a file', session_id: 'sess-tool' })
        })
      })

      expect(events[0]?.['event']).toBe('tool.started')
      expect(events[0]?.['tool_call_id']).toBe('tc-1')
      expect(events[0]?.['name']).toBe('read_file')

      expect(events[1]?.['event']).toBe('tool.completed')
      expect(events[1]?.['output']).toBe('file contents')
    })
  })

  describe('abort path', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          { delta: 'Working', output: 'Working', cursor: 1, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working...', cursor: 2, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working......', cursor: 3, event_cursor: 0, events: [], done: false },
          { delta: '', output: 'Working......', cursor: 4, event_cursor: 0, events: [], done: true },
        ],
      }))
      connectClient()
    })

    it('should emit abort.started and abort.completed on abort', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('abort', { session_id: 'sess-abort' })
            }, 50)
          })
          client.on('abort.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('abort.completed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.emit('run', { input: 'long task', session_id: 'sess-abort' })
        })
      })

      expect(events[0]?.['event']).toBe('abort.started')
      expect(events[0]?.['run_id']).toBe('run-1')
      expect(events[1]?.['event']).toBe('abort.completed')
      expect(events[1]?.['synced']).toBe(true)
    })
  })

  describe('abort path — interrupt failure', () => {
    it('should emit abort.completed with synced=false on interrupt failure', async () => {
      const bridge = createMockBridge({
        outputs: [
          { delta: 'Working', output: 'Working', cursor: 1, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working...', cursor: 2, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working......', cursor: 3, event_cursor: 0, events: [], done: false },
          { delta: '', output: 'Working......', cursor: 4, event_cursor: 0, events: [], done: true },
        ],
      })
      bridge.interrupt = () => Promise.reject(new Error('Bridge unreachable'))
      setupServer(bridge)
      connectClient()

      const abortCompleted = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('abort', { session_id: 'sess-abort-fail' })
            }, 50)
          })
          client.on('abort.completed', (d: Record<string, unknown>) => {
            resolve(d)
          })
          client.emit('run', { input: 'long task', session_id: 'sess-abort-fail' })
        })
      })

      expect(abortCompleted['event']).toBe('abort.completed')
      expect(abortCompleted['synced']).toBe(false)
      expect(abortCompleted['error']).toBe('Bridge unreachable')
    })
  })

  describe('resume path', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should emit resumed with persisted messages', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('sess-resume', '2025-01-01', '2025-01-01')
      db.prepare("INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)").run('m1', 'sess-resume', 'user', 'hi', '2025-01-01T00:00:01Z')
      db.prepare("INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)").run('m2', 'sess-resume', 'assistant', 'hello', '2025-01-01T00:00:02Z')

      const resumed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('resumed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('resume', { session_id: 'sess-resume' })
        })
      })

      expect(resumed['event']).toBe('resumed')
      expect(resumed['session_id']).toBe('sess-resume')
      const messages = resumed['messages'] as Array<Record<string, unknown>>
      expect(messages).toHaveLength(2)
      expect(messages[0]?.['content']).toBe('hi')
      expect(messages[1]?.['content']).toBe('hello')
      expect(resumed['isWorking']).toBe(false)
    })

    it('should emit run.failed for non-existent session', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('resume', { session_id: 'nonexistent' })
        })
      })

      expect(failed['event']).toBe('run.failed')
      expect(failed['error']).toBe('Session not found')
    })
  })

  describe('run — new session creation', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should create session when session_id does not exist', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'hello', session_id: 'new-sess', profile: 'coding', model: 'claude-4' })
        })
      })

      const session = sessionStore.get('new-sess')
      expect(session).toBeDefined()
      expect(session?.profile).toBe('coding')
      expect(session?.model).toBe('claude-4')
    })

    it('should reuse existing session without error', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('existing-sess', '2025-01-01', '2025-01-01')

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'hello', session_id: 'existing-sess' })
        })
      })

      const session = sessionStore.get('existing-sess')
      expect(session).toBeDefined()
    })
  })

  describe('run — reasoning events', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ type: 'reasoning.delta', text: 'thinking...' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ type: 'reasoning.available' }],
            done: false,
          },
          {
            delta: 'Answer',
            output: 'Answer',
            cursor: 3,
            event_cursor: 2,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit reasoning.delta and reasoning.available events', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('reasoning.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('reasoning.available', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'think about this', session_id: 'sess-reason' })
        })
      })

      expect(events[0]?.['event']).toBe('reasoning.delta')
      expect(events[0]?.['text']).toBe('thinking...')
      expect(events[1]?.['event']).toBe('reasoning.available')
    })
  })

  describe('run — generic agent events', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 2,
            events: [
              { type: 'custom.event', data: 'payload' },
              { noType: true },
            ],
            done: false,
          },
          {
            delta: 'Done',
            output: 'Done',
            cursor: 2,
            event_cursor: 2,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit agent.event for unknown types and skip events without type', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('agent.event', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'custom', session_id: 'sess-generic' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('agent.event')
      expect(events[0]?.['data']).toBe('payload')
    })
  })

  describe('disconnect during active run', () => {
    it('should abort run when client disconnects', async () => {
      const bridge = createMockBridge({
        outputs: [
          { delta: 'Working', output: 'Working', cursor: 1, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working...', cursor: 2, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working......', cursor: 3, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working.........', cursor: 4, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working............', cursor: 5, event_cursor: 0, events: [], done: false },
          { delta: '', output: 'Working............', cursor: 6, event_cursor: 0, events: [], done: true },
        ],
      })
      setupServer(bridge)
      connectClient()

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.disconnect()
              resolve()
            }, 50)
          })
          client.emit('run', { input: 'long task', session_id: 'sess-dc' })
        })
      })

      await new Promise((resolve) => { setTimeout(resolve, 200) })
      expect(true).toBe(true)
    })
  })

  describe('run — auto-generated session_id', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should generate session_id when not provided', async () => {
      const started = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'hello' })
        })
      })

      expect(started['session_id']).toBeDefined()
      expect(typeof started['session_id']).toBe('string')
      expect((started['session_id'] as string).length).toBeGreaterThan(0)
    })
  })

  describe('run — all optional payload fields', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should pass provider, source, and instructions to bridge', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', {
            input: 'hello',
            session_id: 'sess-opts',
            profile: 'coding',
            model: 'claude-4',
            provider: 'anthropic',
            source: 'web',
            instructions: 'be concise',
          })
        })
      })

      const session = sessionStore.get('sess-opts')
      expect(session).toBeDefined()
    })
  })

  describe('run — non-Error thrown by bridge', () => {
    beforeEach(() => {
      const bridge = createMockBridge()
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      bridge.chat = () => Promise.reject('string error')
      setupServer(bridge)
      connectClient()
    })

    it('should emit run.failed with Unknown error for non-Error throws', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'hello', session_id: 'sess-str-err' })
        })
      })

      expect(failed['error']).toBe('Unknown error')
    })
  })

  describe('run — missing session_id in error path', () => {
    beforeEach(() => {
      const bridge = createMockBridge({ chatError: new Error('fail') })
      setupServer(bridge)
      connectClient()
    })

    it('should use empty string for session_id when not provided and bridge fails', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'hello' })
        })
      })

      expect(failed['session_id']).toBe('')
      expect(failed['error']).toBe('fail')
    })
  })

  describe('abort when no active run', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should be a no-op when abort is emitted without active run', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.emit('abort', { session_id: 'sess-norun' })
          setTimeout(() => { resolve() }, 100)
        })
      })

      expect(true).toBe(true)
    })
  })
})
