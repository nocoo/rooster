import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/services/hermes/db.js'
import { SessionStore } from '../src/services/hermes/session-store.js'
import { MessageStore } from '../src/services/hermes/message-store.js'
import { AgentBridgeClient } from '../src/services/hermes/agent-bridge.js'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import net from 'node:net'
import { unlinkSync } from 'node:fs'

describe('session search and export routes', () => {
  let app: Hono
  let db: Database.Database
  let sessionStore: SessionStore
  let messageStore: MessageStore
  let bridgeServer: net.Server
  let bridgePath: string

  beforeEach(() => {
    db = createDb(':memory:')
    sessionStore = new SessionStore(db)
    messageStore = new MessageStore(db)

    bridgePath = `/tmp/rooster-test-search-${String(process.pid)}.sock`
    try { unlinkSync(bridgePath) } catch { /* ignore */ }
    bridgeServer = net.createServer((conn) => {
      conn.on('data', () => {
        conn.write(JSON.stringify({ ok: true }) + '\n')
        conn.end()
      })
    })
    bridgeServer.listen(bridgePath)
    const bridge = new AgentBridgeClient({ endpoint: bridgePath })
    app = createApp({ db, bridge })
  })

  describe('GET /api/hermes/sessions/search', () => {
    it('should return 400 when q is missing', async () => {
      const res = await app.request('/api/hermes/sessions/search')
      expect(res.status).toBe(400)
      const body = await res.json() as { error: string }
      expect(body.error).toContain('"q" is required')
    })

    it('should return 400 when q is empty', async () => {
      const res = await app.request('/api/hermes/sessions/search?q=')
      expect(res.status).toBe(400)
    })

    it('should return 400 when q is whitespace only', async () => {
      const res = await app.request('/api/hermes/sessions/search?q=%20%20')
      expect(res.status).toBe(400)
    })

    it('should search by session title', async () => {
      sessionStore.create({ id: 's1', title: 'Fix authentication bug' })
      sessionStore.create({ id: 's2', title: 'Add new feature' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'hello' })
      messageStore.append({ session_id: 's2', role: 'user', content: 'world' })

      const res = await app.request('/api/hermes/sessions/search?q=authentication')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string }; snippet: string | null }>; total: number }
      expect(body.total).toBe(1)
      expect(body.results).toHaveLength(1)
      expect(body.results[0]?.session.id).toBe('s1')
    })

    it('should search by message content and return snippet', async () => {
      sessionStore.create({ id: 's1', title: 'Session one' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'Please fix the login flow' })
      messageStore.append({ session_id: 's1', role: 'assistant', content: 'I will fix it now' })

      const res = await app.request('/api/hermes/sessions/search?q=login')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string }; snippet: string | null }>; total: number }
      expect(body.total).toBe(1)
      expect(body.results[0]?.snippet).toContain('login')
    })

    it('should search by reasoning content', async () => {
      sessionStore.create({ id: 's1', title: 'Normal session' })
      messageStore.append({ session_id: 's1', role: 'assistant', content: 'result', reasoning: 'I need to analyze the webpack config' })

      const res = await app.request('/api/hermes/sessions/search?q=webpack')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string } }>; total: number }
      expect(body.total).toBe(1)
      expect(body.results[0]?.session.id).toBe('s1')
    })

    it('should return empty results for no match', async () => {
      sessionStore.create({ id: 's1', title: 'Something' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'hello' })

      const res = await app.request('/api/hermes/sessions/search?q=nonexistent')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: unknown[]; total: number }
      expect(body.total).toBe(0)
      expect(body.results).toHaveLength(0)
    })

    it('should support pagination with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        sessionStore.create({ id: `s${String(i)}`, title: `Test session ${String(i)}` })
        messageStore.append({ session_id: `s${String(i)}`, role: 'user', content: 'search me' })
      }

      const res = await app.request('/api/hermes/sessions/search?q=search&limit=2&offset=0')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: unknown[]; total: number }
      expect(body.results).toHaveLength(2)
      expect(body.total).toBe(5)

      const res2 = await app.request('/api/hermes/sessions/search?q=search&limit=2&offset=2')
      const body2 = await res2.json() as { results: unknown[]; total: number }
      expect(body2.results).toHaveLength(2)
    })

    it('should cap limit at 100', async () => {
      sessionStore.create({ id: 's1', title: 'Target' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'match' })

      const res = await app.request('/api/hermes/sessions/search?q=match&limit=999')
      expect(res.status).toBe(200)
    })

    it('should search by profile', async () => {
      sessionStore.create({ id: 's1', title: 'Session', profile: 'coding-assistant' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'hi' })

      const res = await app.request('/api/hermes/sessions/search?q=coding-assistant')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string } }>; total: number }
      expect(body.total).toBe(1)
      expect(body.results[0]?.session.id).toBe('s1')
    })

    it('should handle special characters in query', async () => {
      sessionStore.create({ id: 's1', title: 'Fix 100% bug' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'test' })

      const res = await app.request('/api/hermes/sessions/search?q=100%25')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string } }>; total: number }
      expect(body.total).toBe(1)
    })

    it('should deduplicate sessions with multiple matching messages', async () => {
      sessionStore.create({ id: 's1', title: 'Chat' })
      messageStore.append({ session_id: 's1', role: 'user', content: 'deploy the app' })
      messageStore.append({ session_id: 's1', role: 'assistant', content: 'deploying now' })

      const res = await app.request('/api/hermes/sessions/search?q=deploy')
      expect(res.status).toBe(200)
      const body = await res.json() as { results: Array<{ session: { id: string } }>; total: number }
      expect(body.total).toBe(1)
      expect(body.results).toHaveLength(1)
    })
  })

  describe('GET /api/hermes/sessions/:id/export', () => {
    beforeEach(() => {
      sessionStore.create({ id: 'export-1', title: 'Export Test', profile: 'dev', model: 'claude-4', provider: 'anthropic', workspace: '/home/user/project' })
      messageStore.append({ session_id: 'export-1', role: 'user', content: 'Hello world', timestamp: '2026-01-01T00:00:00Z' })
      messageStore.append({
        session_id: 'export-1',
        role: 'assistant',
        content: 'Hi there! How can I help?',
        reasoning: 'User greeted me.\nI should respond politely.',
        timestamp: '2026-01-01T00:00:01Z',
      })
    })

    it('should export as JSON with session metadata and messages', async () => {
      const res = await app.request('/api/hermes/sessions/export-1/export?format=json')
      expect(res.status).toBe(200)
      const body = await res.json() as { session: { id: string; title: string; profile: string }; messages: Array<{ role: string; content: string; reasoning?: string }> }
      expect(body.session.id).toBe('export-1')
      expect(body.session.title).toBe('Export Test')
      expect(body.session.profile).toBe('dev')
      expect(body.messages).toHaveLength(2)
      expect(body.messages[0]?.role).toBe('user')
      expect(body.messages[0]?.content).toBe('Hello world')
      expect(body.messages[1]?.reasoning).toBe('User greeted me.\nI should respond politely.')
    })

    it('should default to JSON when format is omitted', async () => {
      const res = await app.request('/api/hermes/sessions/export-1/export')
      expect(res.status).toBe(200)
      const ct = res.headers.get('content-type') ?? ''
      expect(ct).toContain('json')
    })

    it('should export as Markdown with proper structure', async () => {
      const res = await app.request('/api/hermes/sessions/export-1/export?format=markdown')
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('# Export Test')
      expect(text).toContain('**ID:** export-1')
      expect(text).toContain('**Profile:** dev')
      expect(text).toContain('**Model:** claude-4')
      expect(text).toContain('## Human')
      expect(text).toContain('## Agent')
      expect(text).toContain('Hello world')
      expect(text).toContain('Hi there! How can I help?')
    })

    it('should include reasoning in Markdown as blockquote', async () => {
      const res = await app.request('/api/hermes/sessions/export-1/export?format=markdown')
      const text = await res.text()
      expect(text).toContain('> **Reasoning:**')
      expect(text).toContain('> User greeted me.')
      expect(text).toContain('> I should respond politely.')
    })

    it('should include attachments in JSON export', async () => {
      messageStore.append({
        session_id: 'export-1',
        role: 'user',
        content: 'See this file',
        attachments: [{ id: 'att-1', original_name: 'doc.pdf', mime_type: 'application/pdf', size: 1024 }],
        timestamp: '2026-01-01T00:01:00Z',
      })

      const res = await app.request('/api/hermes/sessions/export-1/export?format=json')
      const body = await res.json() as { messages: Array<{ attachments?: Array<{ id: string; original_name: string }> }> }
      const lastMsg = body.messages[body.messages.length - 1]
      expect(lastMsg?.attachments).toHaveLength(1)
      expect(lastMsg?.attachments?.[0]?.original_name).toBe('doc.pdf')
    })

    it('should include attachments in Markdown export', async () => {
      messageStore.append({
        session_id: 'export-1',
        role: 'user',
        content: 'Check file',
        attachments: [{ id: 'att-1', original_name: 'image.png', mime_type: 'image/png', size: 2048 }],
        timestamp: '2026-01-01T00:01:00Z',
      })

      const res = await app.request('/api/hermes/sessions/export-1/export?format=markdown')
      const text = await res.text()
      expect(text).toContain('**Attachments:**')
      expect(text).toContain('image.png (image/png, 2048 bytes, id: att-1)')
    })

    it('should return 404 for missing session', async () => {
      const res = await app.request('/api/hermes/sessions/nonexistent/export?format=json')
      expect(res.status).toBe(404)
    })

    it('should return 400 for invalid format', async () => {
      const res = await app.request('/api/hermes/sessions/export-1/export?format=csv')
      expect(res.status).toBe(400)
      const body = await res.json() as { error: string }
      expect(body.error).toContain('Invalid format')
    })

    it('should handle session with no messages', async () => {
      sessionStore.create({ id: 'empty-1', title: 'Empty' })

      const res = await app.request('/api/hermes/sessions/empty-1/export?format=json')
      expect(res.status).toBe(200)
      const body = await res.json() as { messages: unknown[] }
      expect(body.messages).toHaveLength(0)
    })

    it('should handle session with no title in Markdown', async () => {
      sessionStore.create({ id: 'no-title' })
      messageStore.append({ session_id: 'no-title', role: 'user', content: 'test' })

      const res = await app.request('/api/hermes/sessions/no-title/export?format=markdown')
      const text = await res.text()
      expect(text).toContain('# Session no-title')
    })

    it('should preserve code blocks in content without double-wrapping', async () => {
      const codeContent = '```typescript\nconst x = 1\n```\n\nSome text after.'
      messageStore.append({ session_id: 'export-1', role: 'assistant', content: codeContent, timestamp: '2026-01-01T00:02:00Z' })

      const res = await app.request('/api/hermes/sessions/export-1/export?format=markdown')
      const text = await res.text()
      expect(text).toContain('```typescript\nconst x = 1\n```')
      const fenceCount = (text.match(/```/g) ?? []).length
      expect(fenceCount).toBe(2)
    })
  })
})
