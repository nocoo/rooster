/**
 * Shared helpers for L2 e2e tests (real `@hono/node-server` `serve()` +
 * `http.Server.listen(0)` + real `fetch`).
 *
 * Per docs/08-6dq-improvement.md §2, this directory must not use
 * `app.request(...)` — that's L1/integration-lite, not L2. The helper
 * here boots a real HTTP server bound to an ephemeral port so each test
 * can drive routes via `fetch`.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createHttpServer, type HttpServer } from '../../src/server.js'
import { createDb } from '../../src/services/hermes/db.js'
import type { AgentBridgeClient, AgentBridgeResponse } from '../../src/services/hermes/agent-bridge.js'
import type Database from 'better-sqlite3'

export interface BridgeBehavior {
  list?: () => Record<string, unknown>
  getHistory?: (sessionId: string) => Record<string, unknown>
}

export function createStubBridge(behavior: BridgeBehavior = {}): AgentBridgeClient {
  const requestFn = (payload: Record<string, unknown>): Promise<AgentBridgeResponse> => {
    const action = payload['action']
    if (action === 'list') {
      return Promise.resolve({ ok: true, ...(behavior.list?.() ?? { sessions: [] }) } satisfies AgentBridgeResponse)
    }
    if (action === 'get_history') {
      const sid = typeof payload['session_id'] === 'string' ? payload['session_id'] : ''
      return Promise.resolve({ ok: true, ...(behavior.getHistory?.(sid) ?? { messages: [] }) } satisfies AgentBridgeResponse)
    }
    return Promise.resolve({ ok: true } satisfies AgentBridgeResponse)
  }
  return {
    ping: () => Promise.resolve({ ok: true } satisfies AgentBridgeResponse),
    request: requestFn,
  } as unknown as AgentBridgeClient
}

export interface E2eHarness {
  url: string
  db: Database.Database
  server: HttpServer
  uploadsDir: string
  close: () => Promise<void>
}

export async function startHarness(opts: { bridge?: AgentBridgeClient } = {}): Promise<E2eHarness> {
  const uploadsDir = mkdtempSync(join(tmpdir(), 'rooster-e2e-uploads-'))
  const db = createDb(':memory:')
  const bridge = opts.bridge ?? createStubBridge()
  const server = createHttpServer({ db, bridge, uploadsDir })
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, () => { resolve() })
  })
  const port = (server.httpServer.address() as AddressInfo).port
  const url = `http://localhost:${String(port)}`
  const close = async (): Promise<void> => {
    await server.close()
    db.close()
    rmSync(uploadsDir, { recursive: true, force: true })
  }
  return { url, db, server, uploadsDir, close }
}
