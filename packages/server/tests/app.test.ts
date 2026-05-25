import { describe, it, expect, beforeEach } from 'vitest'
import type { Hono } from 'hono'
import { createApp } from '../src/app.js'
import { createDb } from '../src/services/hermes/db.js'
import { AgentBridgeClient } from '../src/services/hermes/agent-bridge.js'
import type Database from 'better-sqlite3'
import net from 'node:net'
import { unlinkSync } from 'node:fs'

describe('app routes', () => {
  let app: Hono
  let db: Database.Database
  let bridgeServer: net.Server
  let bridgePath: string

  beforeEach(() => {
    db = createDb(':memory:')
    bridgePath = `/tmp/rooster-test-app-bridge-${String(process.pid)}.sock`
    try { unlinkSync(bridgePath) } catch { /* ignore */ }
    bridgeServer = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          const req = JSON.parse(data.split('\n')[0] ?? '{}') as Record<string, unknown>
          let res: Record<string, unknown> = { ok: true }
          if (req['action'] === 'list') {
            res = {
              ok: true,
              sessions: [
                { profile: 'coding', model: 'claude-4', provider: 'anthropic' },
                { profile: 'chat', model: 'gpt-4', provider: 'openai' },
                { profile: null, model: null, provider: null },
              ],
            }
          }
          conn.write(JSON.stringify(res) + '\n')
          conn.end()
        }
      })
    })
    bridgeServer.listen(bridgePath)
    const bridge = new AgentBridgeClient({ endpoint: bridgePath })
    app = createApp({ db, bridge })
  })

  it('should respond 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })

  describe('GET /health', () => {
    it('should return status ok with timestamp', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string; timestamp: string }
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
      expect(new Date(body.timestamp).getTime()).not.toBeNaN()
    })
  })

  describe('GET /api/hermes/sessions', () => {
    it('should return empty list initially', async () => {
      const res = await app.request('/api/hermes/sessions')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { sessions: unknown[]; total: number }
      expect(body.sessions).toEqual([])
      expect(body.total).toBe(0)
    })

    it('should return sessions with pagination', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('s1', '2025-01-01', '2025-01-01')
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('s2', '2025-01-02', '2025-01-02')
      const res = await app.request('/api/hermes/sessions?limit=1&offset=0')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { sessions: Array<{ id: string }>; total: number }
      expect(body.sessions).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it('should filter sessions by profile', async () => {
      db.prepare("INSERT INTO sessions (id, profile, started_at, last_active) VALUES (?, ?, ?, ?)").run('s1', 'coding', '2025-01-01', '2025-01-01')
      db.prepare("INSERT INTO sessions (id, profile, started_at, last_active) VALUES (?, ?, ?, ?)").run('s2', 'chat', '2025-01-02', '2025-01-02')
      const res = await app.request('/api/hermes/sessions?profile=coding')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { sessions: Array<{ id: string }>; total: number }
      expect(body.sessions).toHaveLength(1)
      expect(body.total).toBe(1)
    })
  })

  describe('GET /api/hermes/sessions/:id', () => {
    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/api/hermes/sessions/nope')
      expect(res.status).toBe(404)
    })

    it('should return session by id', async () => {
      db.prepare("INSERT INTO sessions (id, title, started_at, last_active) VALUES (?, ?, ?, ?)").run('sess-1', 'Test', '2025-01-01', '2025-01-01')
      const res = await app.request('/api/hermes/sessions/sess-1')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string; title: string }
      expect(body.id).toBe('sess-1')
      expect(body.title).toBe('Test')
    })
  })

  describe('DELETE /api/hermes/sessions/:id', () => {
    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/api/hermes/sessions/nope', { method: 'DELETE' })
      expect(res.status).toBe(404)
    })

    it('should delete session', async () => {
      db.prepare("INSERT INTO sessions (id, started_at, last_active) VALUES (?, ?, ?)").run('del-1', '2025-01-01', '2025-01-01')
      const res = await app.request('/api/hermes/sessions/del-1', { method: 'DELETE' })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean }
      expect(body.ok).toBe(true)
    })
  })

  describe('POST /api/hermes/sessions/:id/rename', () => {
    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/api/hermes/sessions/nope/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New' }),
      })
      expect(res.status).toBe(404)
    })

    it('should rename session', async () => {
      db.prepare("INSERT INTO sessions (id, title, started_at, last_active) VALUES (?, ?, ?, ?)").run('ren-1', 'Old', '2025-01-01', '2025-01-01')
      const res = await app.request('/api/hermes/sessions/ren-1/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' }),
      })
      expect(res.status).toBe(200)
      const check = await app.request('/api/hermes/sessions/ren-1')
      const body = (await check.json()) as { title: string }
      expect(body.title).toBe('Renamed')
    })
  })

  describe('GET /api/hermes/profiles', () => {
    it('should return profiles from bridge', async () => {
      const res = await app.request('/api/hermes/profiles')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { profiles: string[] }
      expect(body.profiles).toContain('coding')
      expect(body.profiles).toContain('chat')
    })
  })

  describe('GET /api/hermes/models', () => {
    it('should return models from bridge', async () => {
      const res = await app.request('/api/hermes/models')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { models: string[] }
      expect(body.models).toContain('claude-4')
      expect(body.models).toContain('gpt-4')
    })
  })

  describe('GET /api/hermes/providers', () => {
    it('should return providers from bridge', async () => {
      const res = await app.request('/api/hermes/providers')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { providers: string[] }
      expect(body.providers).toContain('anthropic')
      expect(body.providers).toContain('openai')
    })
  })

  describe('bridge routes with empty sessions', () => {
    it('should return empty arrays when bridge has no sessions field', async () => {
      bridgeServer.close()
      const emptyPath = `/tmp/rooster-test-empty-bridge-${String(process.pid)}.sock`
      try { unlinkSync(emptyPath) } catch { /* ignore */ }
      const emptyServer = net.createServer((conn) => {
        let data = ''
        conn.on('data', (chunk) => {
          data += chunk.toString()
          if (data.includes('\n')) {
            conn.write(JSON.stringify({ ok: true }) + '\n')
            conn.end()
          }
        })
      })
      emptyServer.listen(emptyPath)
      const emptyBridge = new AgentBridgeClient({ endpoint: emptyPath })
      const emptyApp = createApp({ db, bridge: emptyBridge })

      const profiles = await emptyApp.request('/api/hermes/profiles')
      expect(profiles.status).toBe(200)
      expect(((await profiles.json()) as { profiles: string[] }).profiles).toEqual([])

      const models = await emptyApp.request('/api/hermes/models')
      expect(models.status).toBe(200)
      expect(((await models.json()) as { models: string[] }).models).toEqual([])

      const providers = await emptyApp.request('/api/hermes/providers')
      expect(providers.status).toBe(200)
      expect(((await providers.json()) as { providers: string[] }).providers).toEqual([])

      emptyServer.close()
    })
  })
})
