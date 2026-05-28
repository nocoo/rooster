import { describe, it, expect, afterEach } from 'vitest'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { createHttpServer, type HttpServer } from '../../src/server.js'
import { createDb } from '../../src/services/hermes/db.js'
import type { AgentBridgeClient, AgentBridgeChatStarted, AgentBridgeOutput, AgentBridgeResponse } from '../../src/services/hermes/agent-bridge.js'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function createMockBridge(): AgentBridgeClient {
  let outputIndex = 0
  const outputs: AgentBridgeOutput[] = [
    { ok: true, run_id: 'run-1', session_id: 'sess-1', status: 'running', delta: 'Hi', output: 'Hi', cursor: 1, event_cursor: 0, events: [], done: false },
    { ok: true, run_id: 'run-1', session_id: 'sess-1', status: 'complete', delta: ' there', output: 'Hi there', cursor: 2, event_cursor: 0, events: [], done: true },
  ]

  return {
    chat: () => Promise.resolve({
      ok: true,
      run_id: 'run-1',
      session_id: 'sess-1',
      status: 'running',
    } satisfies AgentBridgeChatStarted),
    getOutput: () => {
      const out = outputs[outputIndex] ?? outputs[outputs.length - 1]
      if (outputIndex < outputs.length - 1) outputIndex++
      return Promise.resolve(out as AgentBridgeOutput)
    },
    interrupt: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    ping: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
  } as unknown as AgentBridgeClient
}

describe('Server bootstrap integration', () => {
  let server: HttpServer
  let client: ClientSocket
  let uploadsDir: string

  afterEach(async () => {
    client.disconnect()
    await server.close()
    rmSync(uploadsDir, { recursive: true, force: true })
  })

  it('should serve /chat-run namespace via createHttpServer()', async () => {
    const db = createDb(':memory:')
    uploadsDir = mkdtempSync(join(tmpdir(), 'rooster-test-bootstrap-uploads-'))
    server = createHttpServer({ db, bridge: createMockBridge(), uploadsDir })
    server.httpServer.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port

    client = ioClient(`http://localhost:${String(port)}/chat-run`, {
      transports: ['websocket'],
    })

    const events: Array<Record<string, unknown>> = []

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.on('run.started', (d: Record<string, unknown>) => { events.push(d) })
        client.on('run.completed', (d: Record<string, unknown>) => {
          events.push(d)
          resolve()
        })
        client.emit('run', { input: 'hello', session_id: 'integration-sess' })
      })
    })

    expect(events[0]?.['event']).toBe('run.started')
    expect(events[0]?.['run_id']).toBe('run-1')

    const completed = events[events.length - 1]
    expect(completed?.['event']).toBe('run.completed')
    expect(completed?.['output']).toBe('Hi there')
  })

  it('should serve Hono HTTP routes alongside Socket.IO', async () => {
    const db = createDb(':memory:')
    uploadsDir = mkdtempSync(join(tmpdir(), 'rooster-test-bootstrap-uploads-'))
    server = createHttpServer({ db, bridge: createMockBridge(), uploadsDir })
    server.httpServer.listen(0)
    const port = (server.httpServer.address() as AddressInfo).port

    const res = await fetch(`http://localhost:${String(port)}/health`)
    expect(res.status).toBe(200)
  })
})
