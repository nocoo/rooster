import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import net from 'node:net'
import { AgentBridgeClient, AgentBridgeError, getBridgeClient } from '../src/services/hermes/agent-bridge.js'

function createMockServer(socketPath: string, handler: (request: Record<string, unknown>, conn: net.Socket) => void): net.Server {
  const server = net.createServer((conn) => {
    let data = ''
    conn.on('data', (chunk) => {
      data += chunk.toString()
      const newlineIdx = data.indexOf('\n')
      if (newlineIdx !== -1) {
        const request = JSON.parse(data.slice(0, newlineIdx)) as Record<string, unknown>
        handler(request, conn)
      }
    })
  })
  server.listen(socketPath)
  return server
}

describe('AgentBridgeClient', () => {
  let server: net.Server
  let socketPath: string

  beforeAll(() => {
    socketPath = `/tmp/rooster-test-bridge-${String(process.pid)}.sock`
    server = createMockServer(socketPath, (request, conn) => {
      let response: Record<string, unknown>

      switch (request['action']) {
        case 'ping':
          response = { ok: true }
          break
        case 'chat':
          response = {
            ok: true,
            run_id: 'test-run-1',
            session_id: request['session_id'],
            status: 'running',
          }
          break
        case 'get_output':
          response = {
            ok: true,
            run_id: request['run_id'],
            session_id: 'test-session',
            status: 'complete',
            delta: 'Hello world',
            cursor: 11,
            output: 'Hello world',
            done: true,
            events: [],
            event_cursor: 0,
          }
          break
        case 'interrupt':
          response = { ok: true }
          break
        case 'approval_respond':
          response = { ok: true }
          break
        case 'clarify_respond':
          response = { ok: true }
          break
        default:
          response = { ok: false, error: `Unknown action: ${String(request['action'])}` }
      }
      conn.write(JSON.stringify(response) + '\n')
      conn.end()
    })
  })

  afterAll(() => {
    server.close()
  })

  it('should ping successfully', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.ping()
    expect(result.ok).toBe(true)
  })

  it('should start a chat run', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.chat('session-1', 'Hello')
    expect(result.ok).toBe(true)
    expect(result.run_id).toBe('test-run-1')
    expect(result.session_id).toBe('session-1')
    expect(result.status).toBe('running')
  })

  it('should start a chat with options', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.chat('session-2', 'Hello', {
      profile: 'default',
      model: 'test-model',
      provider: 'test-provider',
      force_compress: true,
      source: 'test',
      instructions: 'be helpful',
      storage_message: 'stored',
    })
    expect(result.ok).toBe(true)
    expect(result.session_id).toBe('session-2')
  })

  it('should get output from a run', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.getOutput('test-run-1', 0, 0)
    expect(result.ok).toBe(true)
    expect(result.done).toBe(true)
    expect(result.delta).toBe('Hello world')
    expect(result.output).toBe('Hello world')
    expect(result.cursor).toBe(11)
  })

  it('should interrupt a session', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.interrupt('session-1')
    expect(result.ok).toBe(true)
  })

  it('should interrupt a session with message', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.interrupt('session-1', 'stop now')
    expect(result.ok).toBe(true)
  })

  it('should respond to approval', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.approvalRespond('approval-1', 'yes')
    expect(result.ok).toBe(true)
  })

  it('should respond to clarification', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.clarifyRespond('clarify-1', 'the answer')
    expect(result.ok).toBe(true)
  })

  it('should throw AgentBridgeError on unknown action', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    await expect(
      client['request']({ action: 'nonexistent' }),
    ).rejects.toThrow(AgentBridgeError)
  })

  it('should serialize concurrent requests', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const results = await Promise.all([
      client.ping(),
      client.ping(),
      client.ping(),
    ])
    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r.ok).toBe(true)
    }
  })

  it('should timeout on unresponsive server', async () => {
    const hangPath = `/tmp/rooster-test-hang-${String(process.pid)}.sock`
    const hangServer = net.createServer(() => {
      // intentionally never respond
    })
    hangServer.listen(hangPath)

    const client = new AgentBridgeClient({
      endpoint: hangPath,
      timeoutMs: 100,
    })

    await expect(client.ping()).rejects.toThrow('timeout')
    hangServer.close()
  })

  it('should throw AgentBridgeError on connection error', async () => {
    const client = new AgentBridgeClient({
      endpoint: '/tmp/rooster-nonexistent-socket.sock',
      connectRetryMs: 0,
    })
    await expect(client.ping()).rejects.toThrow(AgentBridgeError)
  })

  it('should connect via TCP endpoint', async () => {
    const tcpServer = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => {
        data += chunk.toString()
        const idx = data.indexOf('\n')
        if (idx !== -1) {
          conn.write(JSON.stringify({ ok: true }) + '\n')
          conn.end()
        }
      })
    })

    await new Promise<void>((resolve) => {
      tcpServer.listen(0, '127.0.0.1', () => { resolve() })
    })
    const addr = tcpServer.address() as net.AddressInfo
    const client = new AgentBridgeClient({
      endpoint: `tcp://127.0.0.1:${String(addr.port)}`,
    })

    const result = await client.ping()
    expect(result.ok).toBe(true)
    tcpServer.close()
  })

  it('should use default port for TCP without port', async () => {
    const client = new AgentBridgeClient({
      endpoint: 'tcp://127.0.0.1',
      timeoutMs: 100,
      connectRetryMs: 0,
    })
    await expect(client.ping()).rejects.toThrow(AgentBridgeError)
  })

  it('should throw on malformed JSON response', async () => {
    const badPath = `/tmp/rooster-test-bad-${String(process.pid)}.sock`
    const badServer = net.createServer((conn) => {
      conn.on('data', () => {
        conn.write('not valid json\n')
        conn.end()
      })
    })
    badServer.listen(badPath)

    const client = new AgentBridgeClient({ endpoint: badPath })
    await expect(client.ping()).rejects.toThrow('Failed to parse bridge response')
    badServer.close()
  })

  it('should handle partial data chunks', async () => {
    const partialPath = `/tmp/rooster-test-partial-${String(process.pid)}.sock`
    const partialServer = net.createServer((conn) => {
      conn.on('data', () => {
        const full = JSON.stringify({ ok: true }) + '\n'
        conn.write(full.slice(0, 5))
        setTimeout(() => {
          conn.write(full.slice(5))
          conn.end()
        }, 10)
      })
    })
    partialServer.listen(partialPath)

    const client = new AgentBridgeClient({ endpoint: partialPath })
    const result = await client.ping()
    expect(result.ok).toBe(true)
    partialServer.close()
  })

  it('should use default error message when ok:false without error field', async () => {
    const noErrPath = `/tmp/rooster-test-noerr-${String(process.pid)}.sock`
    const noErrServer = net.createServer((conn) => {
      conn.on('data', () => {
        conn.write(JSON.stringify({ ok: false }) + '\n')
        conn.end()
      })
    })
    noErrServer.listen(noErrPath)

    const client = new AgentBridgeClient({ endpoint: noErrPath })
    await expect(client.ping()).rejects.toThrow('Bridge returned ok:false')
    noErrServer.close()
  })

  it('should connect via ipc:// endpoint', async () => {
    const ipcPath = `/tmp/rooster-test-ipc-${String(process.pid)}.sock`
    const ipcServer = createMockServer(ipcPath, (_request, conn) => {
      conn.write(JSON.stringify({ ok: true }) + '\n')
      conn.end()
    })

    const client = new AgentBridgeClient({ endpoint: `ipc://${ipcPath}` })
    const result = await client.ping()
    expect(result.ok).toBe(true)
    ipcServer.close()
  })

  it('should connect via plain unix path endpoint', async () => {
    const client = new AgentBridgeClient({ endpoint: socketPath })
    const result = await client.ping()
    expect(result.ok).toBe(true)
  })

  it('should use default endpoint from env', () => {
    const client = new AgentBridgeClient()
    expect(client['endpoint']).toBe('/tmp/hermes-agent-bridge.sock')
  })
})

describe('AgentBridgeClient retry', () => {
  it('should retry and succeed when server starts within retry window', async () => {
    const retryPath = `/tmp/rooster-test-retry-${String(process.pid)}.sock`
    const client = new AgentBridgeClient({
      endpoint: retryPath,
      connectRetryMs: 500,
    })

    // Start server after 150ms
    setTimeout(() => {
      const srv = createMockServer(retryPath, (_request, conn) => {
        conn.write(JSON.stringify({ ok: true }) + '\n')
        conn.end()
      })
      // Clean up after test
      setTimeout(() => { srv.close() }, 500)
    }, 150)

    const result = await client.ping()
    expect(result.ok).toBe(true)
  })

  it('should fail after retry window expires', async () => {
    const client = new AgentBridgeClient({
      endpoint: '/tmp/rooster-never-exists.sock',
      connectRetryMs: 200,
    })

    await expect(client.ping()).rejects.toThrow(AgentBridgeError)
  })

  it('should not retry on non-retryable errors (ok:false)', async () => {
    const noRetryPath = `/tmp/rooster-test-noretry-${String(process.pid)}.sock`
    const callCount = { value: 0 }
    const noRetryServer = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          callCount.value++
          conn.write(JSON.stringify({ ok: false, error: 'denied' }) + '\n')
          conn.end()
        }
      })
    })
    noRetryServer.listen(noRetryPath)

    const client = new AgentBridgeClient({
      endpoint: noRetryPath,
      connectRetryMs: 500,
    })
    await expect(client.ping()).rejects.toThrow('denied')
    expect(callCount.value).toBe(1)
    noRetryServer.close()
  })
})

describe('getBridgeClient', () => {
  it('should return the same instance on subsequent calls', () => {
    const a = getBridgeClient()
    const b = getBridgeClient()
    expect(a).toBe(b)
  })
})
