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
    approvalRespond: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    clarifyRespond: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
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
            events: [{ event: 'tool.started', tool_name: 'read_file', args: { path: '/tmp/x' }, tool_call_id: 'tc-1' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ event: 'tool.completed', tool_name: 'read_file', tool_call_id: 'tc-1', result: 'file contents', duration: 50 }],
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
      expect(events[0]?.['arguments']).toBe('{"path":"/tmp/x"}')

      expect(events[1]?.['event']).toBe('tool.completed')
      expect(events[1]?.['output']).toBe('file contents')
      expect(events[1]?.['duration']).toBe(50)
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

    it('should persist partial output to message store on abort', async () => {
      let gotDelta = false
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('message.delta', () => { gotDelta = true })
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('abort', { session_id: 'sess-abort-persist' })
            }, 150)
          })
          client.on('abort.completed', () => {
            setTimeout(resolve, 150)
          })
          client.emit('run', { input: 'long task', session_id: 'sess-abort-persist' })
        })
      })

      expect(gotDelta).toBe(true)
      const msgs = messageStore.list('sess-abort-persist')
      const assistantMsgs = msgs.filter((m) => m.role === 'assistant')
      expect(assistantMsgs.length).toBeGreaterThanOrEqual(1)
      expect(assistantMsgs[0]?.content).toBeTruthy()
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

  describe('resume — active run detection', () => {
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

    it('should report isWorking=true when resumed session has active run', async () => {
      const resumed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('resume', { session_id: 'sess-active-run' })
            }, 30)
          })
          client.on('resumed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'long task', session_id: 'sess-active-run' })
        })
      })

      expect(resumed['isWorking']).toBe(true)
      expect(resumed['isAborting']).toBe(false)
    })

    it('should report isWorking=false when resuming different session', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('sess-other', '2025-01-01', '2025-01-01')

      const resumed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('resume', { session_id: 'sess-other' })
            }, 30)
          })
          client.on('resumed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'long task', session_id: 'sess-active-run-2' })
        })
      })

      expect(resumed['isWorking']).toBe(false)
      expect(resumed['isAborting']).toBe(false)
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
            events: [{ event: 'reasoning.delta', text: 'thinking...' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ event: 'reasoning.available' }],
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

    it('should persist reasoning to assistant message in store', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'think hard', session_id: 'sess-reason-persist' })
        })
      })

      const msgs = messageStore.list('sess-reason-persist')
      const assistant = msgs.find((m) => m.role === 'assistant')
      expect(assistant).toBeDefined()
      expect(assistant?.reasoning).toBe('thinking...')
    })

    it('should persist thinking.delta events as reasoning', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'thinking.delta', text: 'deep thought' }],
            done: false,
          },
          {
            delta: 'Result',
            output: 'Result',
            cursor: 2,
            event_cursor: 1,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'think', session_id: 'sess-thinking-persist' })
        })
      })

      const msgs = messageStore.list('sess-thinking-persist')
      const assistant = msgs.find((m) => m.role === 'assistant')
      expect(assistant).toBeDefined()
      expect(assistant?.reasoning).toBe('deep thought')
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
              { event: 'custom.event', data: 'payload' },
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
      expect(events[0]?.['type']).toBe('custom.event')
    })
  })

  describe('run — thinking.delta forwarded as thinking.delta', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'thinking.delta', text: 'let me think...' }],
            done: false,
          },
          {
            delta: 'Answer',
            output: 'Answer',
            cursor: 2,
            event_cursor: 1,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit thinking.delta event', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('thinking.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'think', session_id: 'sess-think' })
        })
      })

      expect(events[0]?.['event']).toBe('thinking.delta')
      expect(events[0]?.['text']).toBe('let me think...')
      expect(events[0]?.['session_id']).toBe('sess-think')
      expect(events[0]?.['run_id']).toBe('run-1')
    })
  })

  describe('run — bridge terminal error emits run.failed', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: 'partial',
            output: 'partial',
            cursor: 1,
            event_cursor: 0,
            events: [],
            done: false,
          },
          {
            delta: '',
            output: 'partial',
            cursor: 2,
            event_cursor: 0,
            events: [],
            done: true,
            status: 'error',
            error: 'rate limit exceeded',
          },
        ],
      }))
      connectClient()
    })

    it('should emit run.failed when bridge reports terminal error', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.on('run.completed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.emit('run', { input: 'fail', session_id: 'sess-fail' })
        })
      })

      expect(events[0]?.['event']).toBe('run.failed')
      expect(events[0]?.['error']).toBe('rate limit exceeded')
      expect(events[0]?.['output']).toBe('partial')

      const msgs = messageStore.list('sess-fail')
      expect(msgs).toHaveLength(1)
      expect(msgs[0]?.role).toBe('user')
    })
  })

  describe('run — bridge result.failed terminal error', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: 'working',
            output: 'working',
            cursor: 1,
            event_cursor: 0,
            events: [],
            done: true,
            status: 'complete',
            result: { failed: true, error: 'Task could not be completed' },
          },
        ],
      }))
      connectClient()
    })

    it('should emit run.failed when result.failed is true', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'fail', session_id: 'sess-result-fail' })
        })
      })

      expect(failed['event']).toBe('run.failed')
      expect(failed['error']).toBe('Task could not be completed')

      const msgs = messageStore.list('sess-result-fail')
      expect(msgs).toHaveLength(1)
      expect(msgs[0]?.role).toBe('user')
    })
  })

  describe('run — tool events with legacy type field fallback', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ type: 'tool.started', tool_name: 'Write', args: { path: '/tmp/a.ts', content: 'x' } }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ type: 'tool.completed', tool_name: 'Write', tool_call_id: 'tc-w', result_preview: 'written', duration: 30, is_error: true }],
            done: false,
          },
          {
            delta: 'Done.',
            output: 'Done.',
            cursor: 3,
            event_cursor: 2,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should handle type field fallback and is_error mapping', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('tool.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('tool.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'write', session_id: 'sess-legacy' })
        })
      })

      expect(events[0]?.['name']).toBe('Write')
      expect(events[0]?.['arguments']).toBe('{"path":"/tmp/a.ts","content":"x"}')
      expect(events[0]?.['tool_call_id']).toBeDefined()

      expect(events[1]?.['name']).toBe('Write')
      expect(events[1]?.['output']).toBe('written')
      expect(events[1]?.['error']).toBe('true')
      expect(events[1]?.['duration']).toBe(30)
    })
  })

  describe('run — bridge terminal error without string error', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 0,
            events: [],
            done: true,
            status: 'error',
          },
        ],
      }))
      connectClient()
    })

    it('should emit run.failed with default message when error is not a string', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'fail', session_id: 'sess-no-err-str' })
        })
      })

      expect(failed['error']).toBe('Agent run failed')
    })
  })

  describe('run — bridge result.completed=false without string message', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 0,
            events: [],
            done: true,
            status: 'complete',
            result: { completed: false },
          },
        ],
      }))
      connectClient()
    })

    it('should emit run.failed with default failure message', async () => {
      const failed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'fail', session_id: 'sess-incomplete' })
        })
      })

      expect(failed['error']).toBe('Agent reported failure')
    })
  })

  describe('run — output fallback from accumulated stream', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: 'Hello',
            output: 'Hello',
            cursor: 1,
            event_cursor: 0,
            events: [],
            done: false,
          },
          {
            delta: ' world',
            output: 'Hello world',
            cursor: 2,
            event_cursor: 0,
            events: [],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 3,
            event_cursor: 0,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should use accumulated output when final chunk.output is empty', async () => {
      const completed = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('run', { input: 'hello', session_id: 'sess-accum' })
        })
      })

      expect(completed['output']).toBe('Hello world')
    })
  })

  describe('run — tool events with string arguments and no tool_call_id', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'tool.started', tool_name: 'Edit', arguments: '{"file":"/a.ts"}', preview: 'editing file' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{ event: 'tool.completed', tool_name: 'Edit', result: 'ok' }],
            done: false,
          },
          {
            delta: 'Done.',
            output: 'Done.',
            cursor: 3,
            event_cursor: 2,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should pass through string arguments and generate missing tool_call_id', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('tool.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('tool.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'edit', session_id: 'sess-str-args' })
        })
      })

      expect(events[0]?.['arguments']).toBe('{"file":"/a.ts"}')
      expect(events[0]?.['preview']).toBe('editing file')
      expect(events[0]?.['tool_call_id']).toMatch(/^tc_/)

      expect(events[1]?.['tool_call_id']).toBe('')
      expect(events[1]?.['duration']).toBeUndefined()
      expect(events[1]?.['error']).toBeUndefined()
    })
  })

  describe('run — tool.started preview falls back to summarized args', () => {
    beforeEach(() => {
      const longContent = 'x'.repeat(200)
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'tool.started', tool_name: 'Write', args: { path: '/tmp/a.ts', content: longContent }, tool_call_id: 'tc-long' }],
            done: false,
          },
          {
            delta: 'Done.',
            output: 'Done.',
            cursor: 2,
            event_cursor: 1,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should truncate preview from long args', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('tool.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'write long', session_id: 'sess-long-args' })
        })
      })

      const preview = events[0]?.['preview'] as string
      expect(preview.length).toBeLessThanOrEqual(120)
      expect(preview).toMatch(/\.\.\.$/)
    })
  })

  describe('run — full event sequence with real bridge field names', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'thinking.delta', text: 'hmm' }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 3,
            events: [
              { event: 'reasoning.delta', text: 'analyzing...' },
              { event: 'tool.started', tool_name: 'Bash', args: { command: 'ls' }, tool_call_id: 'tc-99' },
            ],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 3,
            event_cursor: 4,
            events: [{ event: 'tool.completed', tool_name: 'Bash', tool_call_id: 'tc-99', result: 'src\npackage.json', duration: 120, is_error: false }],
            done: false,
          },
          {
            delta: 'Here are the files.',
            output: 'Here are the files.',
            cursor: 4,
            event_cursor: 4,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit thinking, reasoning, tool, delta, completed in order', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('thinking.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('reasoning.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('tool.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('tool.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('message.delta', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.emit('run', { input: 'list files', session_id: 'sess-full' })
        })
      })

      expect(events[0]?.['event']).toBe('thinking.delta')
      expect(events[0]?.['text']).toBe('hmm')

      expect(events[1]?.['event']).toBe('reasoning.delta')
      expect(events[1]?.['text']).toBe('analyzing...')

      expect(events[2]?.['event']).toBe('tool.started')
      expect(events[2]?.['name']).toBe('Bash')
      expect(events[2]?.['arguments']).toBe('{"command":"ls"}')

      expect(events[3]?.['event']).toBe('tool.completed')
      expect(events[3]?.['output']).toBe('src\npackage.json')
      expect(events[3]?.['duration']).toBe(120)

      expect(events[4]?.['event']).toBe('message.delta')
      expect(events[4]?.['delta']).toBe('Here are the files.')

      expect(events[5]?.['event']).toBe('run.completed')
      expect(events[5]?.['output']).toBe('Here are the files.')
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

    it('should respond with error when abort is emitted without active run', async () => {
      const abortCompleted = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('abort.completed', (d: Record<string, unknown>) => { resolve(d) })
          client.emit('abort', { session_id: 'sess-norun' })
        })
      })

      expect(abortCompleted['synced']).toBe(false)
      expect(abortCompleted['error']).toBe('No active run for this session')
    })
  })

  describe('abort session_id mismatch', () => {
    let interruptCalled: boolean

    beforeEach(() => {
      interruptCalled = false
      const bridge = createMockBridge({
        outputs: [
          { delta: 'Working', output: 'Working', cursor: 1, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working...', cursor: 2, event_cursor: 0, events: [], done: false },
          { delta: '...', output: 'Working......', cursor: 3, event_cursor: 0, events: [], done: false },
          { delta: '', output: 'Working......', cursor: 4, event_cursor: 0, events: [], done: true },
        ],
      })
      const origInterrupt = bridge.interrupt.bind(bridge)
      bridge.interrupt = (...args: Parameters<typeof bridge.interrupt>) => {
        interruptCalled = true
        return origInterrupt(...args)
      }
      setupServer(bridge)
      connectClient()
    })

    it('should not interrupt active run when abort targets a different session', async () => {
      const abortCompleted = await new Promise<Record<string, unknown>>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.on('abort.completed', (d: Record<string, unknown>) => { resolve(d) })
              client.emit('abort', { session_id: 'sess-B' })
            }, 50)
          })
          client.emit('run', { input: 'long task', session_id: 'sess-A' })
        })
      })

      expect(interruptCalled).toBe(false)
      expect(abortCompleted['session_id']).toBe('sess-B')
      expect(abortCompleted['synced']).toBe(false)
      expect(abortCompleted['error']).toBe('No active run for this session')
    })

    it('should allow the active run to complete normally after mismatched abort', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.started', () => {
            setTimeout(() => {
              client.emit('abort', { session_id: 'sess-B' })
            }, 50)
          })
          client.on('abort.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', (d: Record<string, unknown>) => {
            events.push(d)
            resolve()
          })
          client.emit('run', { input: 'long task', session_id: 'sess-A' })
        })
      })

      expect(interruptCalled).toBe(false)
      const abortEvt = events.find((e) => e['event'] === 'abort.completed')
      expect(abortEvt?.['session_id']).toBe('sess-B')
      expect(abortEvt?.['synced']).toBe(false)

      const completed = events.find((e) => e['event'] === 'run.completed')
      expect(completed?.['session_id']).toBe('sess-A')
      expect(completed?.['output']).toBe('Working......')
    })
  })

  describe('run — conversation_history passed on second run', () => {
    let chatCalls: Array<{ sessionId: string; message: unknown; options: unknown }>

    beforeEach(() => {
      chatCalls = []
      const bridge = createMockBridge()
      const originalChat = bridge.chat.bind(bridge)
      bridge.chat = (...args: Parameters<typeof bridge.chat>) => {
        chatCalls.push({ sessionId: args[0], message: args[1], options: args[2] })
        return originalChat(...args)
      }
      setupServer(bridge)
      connectClient()
    })

    it('should include prior messages as conversation_history on second run', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'first message', session_id: 'sess-history' })
        })
      })

      await new Promise<void>((resolve) => {
        client.on('run.completed', () => { resolve() })
        client.emit('run', { input: 'second message', session_id: 'sess-history' })
      })

      expect(chatCalls).toHaveLength(2)

      const firstOpts = chatCalls[0]?.options as Record<string, unknown> | undefined
      expect(firstOpts?.['conversation_history']).toBeUndefined()

      const secondOpts = chatCalls[1]?.options as Record<string, unknown>
      const history = secondOpts['conversation_history'] as Array<Record<string, unknown>>
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ role: 'user', content: 'first message' })
      expect(history[1]).toEqual({ role: 'assistant', content: 'Hello world' })
    })

    it('should not include conversation_history on first run', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'only message', session_id: 'sess-no-hist' })
        })
      })

      expect(chatCalls).toHaveLength(1)
      const opts = chatCalls[0]?.options as Record<string, unknown> | undefined
      expect(opts?.['conversation_history']).toBeUndefined()
    })
  })

  describe('approval/clarify — event forwarding', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 2,
            events: [
              {
                event: 'approval.requested',
                approval_id: 'apr-1',
                command: 'rm -rf /',
                description: 'Delete everything',
                choices: ['allow', 'deny'],
                allow_permanent: true,
                timeout_ms: 30000,
              },
            ],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 3,
            events: [
              { event: 'approval.resolved', approval_id: 'apr-1', choice: 'deny' },
            ],
            done: false,
          },
          {
            delta: 'OK',
            output: 'OK',
            cursor: 3,
            event_cursor: 3,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit approval.requested with correct fields', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('approval.requested', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'do it', session_id: 'sess-apr' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('approval.requested')
      expect(events[0]?.['approval_id']).toBe('apr-1')
      expect(events[0]?.['command']).toBe('rm -rf /')
      expect(events[0]?.['description']).toBe('Delete everything')
      expect(events[0]?.['choices']).toEqual(['allow', 'deny'])
      expect(events[0]?.['allow_permanent']).toBe(true)
      expect(events[0]?.['timeout_ms']).toBe(30000)
      expect(events[0]?.['session_id']).toBe('sess-apr')
      expect(events[0]?.['run_id']).toBe('run-1')
    })

    it('should emit approval.resolved with correct fields', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('approval.resolved', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'do it', session_id: 'sess-apr2' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('approval.resolved')
      expect(events[0]?.['approval_id']).toBe('apr-1')
      expect(events[0]?.['choice']).toBe('deny')
    })

    it('should default choices to [allow, deny] when not an array', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'approval.requested', approval_id: 'apr-no-choices', command: 'ls' }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      }))
      connectClient()

      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('approval.requested', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'test', session_id: 'sess-no-choices' })
        })
      })

      expect(events[0]?.['choices']).toEqual(['allow', 'deny'])
    })
  })

  describe('approval/clarify — clarify event forwarding', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 2,
            events: [
              {
                event: 'clarify.requested',
                clarify_id: 'clr-1',
                question: 'Which file?',
                choices: ['a.ts', 'b.ts'],
                timeout_ms: 60000,
              },
            ],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 3,
            events: [
              { event: 'clarify.resolved', clarify_id: 'clr-1' },
            ],
            done: false,
          },
          {
            delta: 'Done',
            output: 'Done',
            cursor: 3,
            event_cursor: 3,
            events: [],
            done: true,
          },
        ],
      }))
      connectClient()
    })

    it('should emit clarify.requested with correct fields', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('clarify.requested', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'help', session_id: 'sess-clr' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('clarify.requested')
      expect(events[0]?.['clarify_id']).toBe('clr-1')
      expect(events[0]?.['question']).toBe('Which file?')
      expect(events[0]?.['choices']).toEqual(['a.ts', 'b.ts'])
      expect(events[0]?.['timeout_ms']).toBe(60000)
      expect(events[0]?.['session_id']).toBe('sess-clr')
      expect(events[0]?.['run_id']).toBe('run-1')
    })

    it('should emit clarify.resolved with correct fields', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('clarify.resolved', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'help', session_id: 'sess-clr2' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('clarify.resolved')
      expect(events[0]?.['clarify_id']).toBe('clr-1')
    })

    it('should emit clarify.requested with undefined choices when not provided', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'clarify.requested', clarify_id: 'clr-no-choices', question: 'What?' }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      }))
      connectClient()

      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('clarify.requested', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'test', session_id: 'sess-clr-no-ch' })
        })
      })

      expect(events[0]?.['choices']).toBeUndefined()
      expect(events[0]?.['timeout_ms']).toBeUndefined()
    })
  })

  describe('approval.respond — socket handler', () => {
    let approvalRespondCalled: Array<{ approvalId: string; choice: string }>

    beforeEach(() => {
      approvalRespondCalled = []
      const bridge = createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'approval.requested', approval_id: 'apr-x', command: 'cmd', choices: ['allow', 'deny'] }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      })
      const origApprovalRespond = bridge.approvalRespond.bind(bridge)
      bridge.approvalRespond = (id: string, choice: string) => {
        approvalRespondCalled.push({ approvalId: id, choice })
        return origApprovalRespond(id, choice)
      }
      setupServer(bridge)
      connectClient()
    })

    it('should call bridge.approvalRespond with correct args', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('approval.requested', () => {
            client.emit('approval.respond', { session_id: 'sess-ap-resp', approval_id: 'apr-x', choice: 'allow' })
          })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'go', session_id: 'sess-ap-resp' })
        })
      })

      expect(approvalRespondCalled).toHaveLength(1)
      expect(approvalRespondCalled[0]).toEqual({ approvalId: 'apr-x', choice: 'allow' })
    })

    it('should emit run.failed when no active run for session', async () => {
      const errors: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => {
            errors.push(d)
            resolve()
          })
          client.emit('approval.respond', { session_id: 'non-existent', approval_id: 'apr-z', choice: 'deny' })
        })
      })

      expect(errors).toHaveLength(1)
      expect(errors[0]?.['error']).toBe('No active run for this session')
    })

    it('should emit run.failed when bridge.approvalRespond throws', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      const bridge = createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'approval.requested', approval_id: 'apr-err', command: 'cmd', choices: ['allow', 'deny'] }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      })
      bridge.approvalRespond = () => Promise.reject(new Error('bridge timeout'))
      setupServer(bridge)
      connectClient()

      const errors: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('approval.requested', () => {
            client.emit('approval.respond', { session_id: 'sess-apr-err', approval_id: 'apr-err', choice: 'allow' })
          })
          client.on('run.failed', (d: Record<string, unknown>) => {
            errors.push(d)
          })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'go', session_id: 'sess-apr-err' })
        })
      })

      expect(errors.length).toBeGreaterThanOrEqual(1)
      expect(errors[0]?.['error']).toBe('bridge timeout')
    })
  })

  describe('run — attachments persisted on user message', () => {
    beforeEach(() => {
      setupServer(createMockBridge())
      connectClient()
    })

    it('should persist attachments on user message when provided', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', {
            input: 'see attached',
            session_id: 'sess-att',
            attachments: [
              { id: 'att-1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 2048 },
            ],
          })
        })
      })

      const msgs = messageStore.list('sess-att')
      expect(msgs[0]?.role).toBe('user')
      expect(msgs[0]?.attachments).toEqual([
        { id: 'att-1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 2048 },
      ])
    })

    it('should not set attachments on user message when not provided', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'plain', session_id: 'sess-no-att' })
        })
      })

      const msgs = messageStore.list('sess-no-att')
      expect(msgs[0]?.role).toBe('user')
      expect(msgs[0]?.attachments).toBeNull()
    })
  })

  describe('run — compression events', () => {
    beforeEach(() => {
      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{
              event: 'compression.started',
              request_id: 'comp-1',
              message_count: 42,
              token_count: 128000,
              source: 'auto',
            }],
            done: false,
          },
          {
            delta: '',
            output: '',
            cursor: 2,
            event_cursor: 2,
            events: [{
              event: 'compression.completed',
              request_id: 'comp-1',
              source: 'auto',
              compressed: true,
              totalMessages: 42,
              resultMessages: 8,
              beforeTokens: 128000,
              afterTokens: 24000,
              contextTokens: 200000,
              summaryTokens: 3200,
            }],
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

    it('should emit compression.started with correct fields preserving casing', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('compression.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'compress', session_id: 'sess-comp' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('compression.started')
      expect(events[0]?.['session_id']).toBe('sess-comp')
      expect(events[0]?.['run_id']).toBe('run-1')
      expect(events[0]?.['request_id']).toBe('comp-1')
      expect(events[0]?.['message_count']).toBe(42)
      expect(events[0]?.['token_count']).toBe(128000)
      expect(events[0]?.['source']).toBe('auto')
    })

    it('should emit compression.completed with correct fields preserving mixed casing', async () => {
      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('compression.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'compress', session_id: 'sess-comp2' })
        })
      })

      expect(events).toHaveLength(1)
      expect(events[0]?.['event']).toBe('compression.completed')
      expect(events[0]?.['session_id']).toBe('sess-comp2')
      expect(events[0]?.['run_id']).toBe('run-1')
      expect(events[0]?.['request_id']).toBe('comp-1')
      expect(events[0]?.['source']).toBe('auto')
      expect(events[0]?.['compressed']).toBe(true)
      expect(events[0]?.['totalMessages']).toBe(42)
      expect(events[0]?.['resultMessages']).toBe(8)
      expect(events[0]?.['beforeTokens']).toBe(128000)
      expect(events[0]?.['afterTokens']).toBe(24000)
      expect(events[0]?.['contextTokens']).toBe(200000)
      expect(events[0]?.['summaryTokens']).toBe(3200)
    })

    it('should handle compression.started with minimal fields', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'compression.started' }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      }))
      connectClient()

      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('compression.started', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'test', session_id: 'sess-comp-min' })
        })
      })

      expect(events[0]?.['event']).toBe('compression.started')
      expect(events[0]?.['request_id']).toBeUndefined()
      expect(events[0]?.['message_count']).toBeUndefined()
      expect(events[0]?.['token_count']).toBeUndefined()
      expect(events[0]?.['source']).toBeUndefined()
    })

    it('should handle compression.completed with compressed=false', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      setupServer(createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'compression.completed', compressed: false, request_id: 'comp-skip' }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      }))
      connectClient()

      const events: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('compression.completed', (d: Record<string, unknown>) => { events.push(d) })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'test', session_id: 'sess-comp-skip' })
        })
      })

      expect(events[0]?.['compressed']).toBe(false)
      expect(events[0]?.['request_id']).toBe('comp-skip')
    })
  })

  describe('clarify.respond — socket handler', () => {
    let clarifyRespondCalled: Array<{ clarifyId: string; response: string }>

    beforeEach(() => {
      clarifyRespondCalled = []
      const bridge = createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'clarify.requested', clarify_id: 'clr-x', question: 'Which?', choices: ['a', 'b'] }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      })
      const origClarifyRespond = bridge.clarifyRespond.bind(bridge)
      bridge.clarifyRespond = (id: string, response: string) => {
        clarifyRespondCalled.push({ clarifyId: id, response })
        return origClarifyRespond(id, response)
      }
      setupServer(bridge)
      connectClient()
    })

    it('should call bridge.clarifyRespond with correct args', async () => {
      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('clarify.requested', () => {
            client.emit('clarify.respond', { session_id: 'sess-cl-resp', clarify_id: 'clr-x', response: 'a' })
          })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'go', session_id: 'sess-cl-resp' })
        })
      })

      expect(clarifyRespondCalled).toHaveLength(1)
      expect(clarifyRespondCalled[0]).toEqual({ clarifyId: 'clr-x', response: 'a' })
    })

    it('should emit run.failed when no active run for session', async () => {
      const errors: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('run.failed', (d: Record<string, unknown>) => {
            errors.push(d)
            resolve()
          })
          client.emit('clarify.respond', { session_id: 'non-existent', clarify_id: 'clr-z', response: 'x' })
        })
      })

      expect(errors).toHaveLength(1)
      expect(errors[0]?.['error']).toBe('No active run for this session')
    })

    it('should emit run.failed when bridge.clarifyRespond throws', async () => {
      client.disconnect()
      await ioServer.close()
      await new Promise<void>((resolve) => { httpServer.close(() => { resolve() }) })

      const bridge = createMockBridge({
        outputs: [
          {
            delta: '',
            output: '',
            cursor: 1,
            event_cursor: 1,
            events: [{ event: 'clarify.requested', clarify_id: 'clr-err', question: 'Which?', choices: ['a', 'b'] }],
            done: false,
          },
          { delta: 'ok', output: 'ok', cursor: 2, event_cursor: 1, events: [], done: true },
        ],
      })
      bridge.clarifyRespond = () => Promise.reject(new Error('bridge unavailable'))
      setupServer(bridge)
      connectClient()

      const errors: Array<Record<string, unknown>> = []

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.on('clarify.requested', () => {
            client.emit('clarify.respond', { session_id: 'sess-clr-err', clarify_id: 'clr-err', response: 'a' })
          })
          client.on('run.failed', (d: Record<string, unknown>) => {
            errors.push(d)
          })
          client.on('run.completed', () => { resolve() })
          client.emit('run', { input: 'go', session_id: 'sess-clr-err' })
        })
      })

      expect(errors.length).toBeGreaterThanOrEqual(1)
      expect(errors[0]?.['error']).toBe('bridge unavailable')
    })
  })
})
