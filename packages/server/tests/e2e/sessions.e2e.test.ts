import { describe, it, expect, afterEach } from 'vitest'
import { SessionStore } from '../../src/services/hermes/session-store.js'
import { MessageStore } from '../../src/services/hermes/message-store.js'
import { startHarness, createStubBridge, type E2eHarness } from './_harness.js'

function seedSession(harness: E2eHarness, title = 'happy session'): string {
  const store = new SessionStore(harness.db)
  const session = store.create({ profile: 'p1', model: 'm1', provider: 'pr1', title })
  return session.id
}

function seedMessage(harness: E2eHarness, sessionId: string, content = 'hello'): void {
  const store = new MessageStore(harness.db)
  store.append({ session_id: sessionId, role: 'user', content })
}

describe('Sessions HTTP routes (L2 e2e)', () => {
  let harness: E2eHarness | undefined

  afterEach(async () => {
    if (harness) await harness.close()
    harness = undefined
  })

  it('GET /api/hermes/search/sessions runs full-text search', async () => {
    harness = await startHarness()
    const sid = seedSession(harness, 'searchable title token')
    seedMessage(harness, sid, 'searchable')
    const res = await fetch(`${harness.url}/api/hermes/search/sessions?q=searchable`)
    expect(res.status).toBe(200)
    const body = await res.json() as { results: unknown[]; total: number }
    expect(typeof body.total).toBe('number')
  })

  it('GET /api/hermes/sessions/search runs aliased full-text search', async () => {
    harness = await startHarness()
    seedSession(harness, 'alias search token')
    const res = await fetch(`${harness.url}/api/hermes/sessions/search?q=alias`)
    expect(res.status).toBe(200)
    const body = await res.json() as { results: unknown[]; total: number }
    expect(Array.isArray(body.results)).toBe(true)
  })

  it('GET /api/hermes/sessions lists sessions', async () => {
    harness = await startHarness()
    seedSession(harness)
    const res = await fetch(`${harness.url}/api/hermes/sessions`)
    expect(res.status).toBe(200)
    const body = await res.json() as { sessions: unknown[]; total: number }
    expect(body.total).toBe(1)
  })

  it('GET /api/hermes/sessions/conversations lists conversations', async () => {
    harness = await startHarness()
    seedSession(harness)
    const res = await fetch(`${harness.url}/api/hermes/sessions/conversations`)
    expect(res.status).toBe(200)
    const body = await res.json() as { conversations: unknown[] }
    expect(Array.isArray(body.conversations)).toBe(true)
  })

  it('GET /api/hermes/sessions/conversations/:id/messages returns messages', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    seedMessage(harness, sid)
    const res = await fetch(`${harness.url}/api/hermes/sessions/conversations/${sid}/messages`)
    expect(res.status).toBe(200)
    const body = await res.json() as { messages: unknown[] }
    expect(body.messages.length).toBe(1)
  })

  it('GET /api/hermes/sessions/conversations/:id/messages/paginated paginates messages', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    seedMessage(harness, sid)
    const res = await fetch(`${harness.url}/api/hermes/sessions/conversations/${sid}/messages/paginated?limit=10`)
    expect(res.status).toBe(200)
    const body = await res.json() as { messages: unknown[]; total: number }
    expect(body.total).toBe(1)
  })

  it('GET /api/hermes/sessions/hermes proxies bridge list action', async () => {
    const bridge = createStubBridge({ list: () => ({ sessions: [{ id: 'h-1' }] }) })
    harness = await startHarness({ bridge })
    const res = await fetch(`${harness.url}/api/hermes/sessions/hermes`)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; sessions: Array<Record<string, unknown>> }
    expect(body.ok).toBe(true)
    expect(body.sessions[0]?.['id']).toBe('h-1')
  })

  it('GET /api/hermes/sessions/hermes/:id proxies bridge get_history action', async () => {
    const bridge = createStubBridge({ getHistory: (id) => ({ session_id: id, messages: [] }) })
    harness = await startHarness({ bridge })
    const res = await fetch(`${harness.url}/api/hermes/sessions/hermes/sid-xyz`)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; session_id: string }
    expect(body.session_id).toBe('sid-xyz')
  })

  it('GET /api/hermes/sessions/:id/export exports session as JSON', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    seedMessage(harness, sid)
    const res = await fetch(`${harness.url}/api/hermes/sessions/${sid}/export`)
    expect(res.status).toBe(200)
    const body = await res.json() as { session: { id: string } }
    expect(body.session.id).toBe(sid)
  })

  it('GET /api/hermes/sessions/:id returns session detail', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    const res = await fetch(`${harness.url}/api/hermes/sessions/${sid}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string }
    expect(body.id).toBe(sid)
  })

  it('DELETE /api/hermes/sessions/:id deletes session', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    const res = await fetch(`${harness.url}/api/hermes/sessions/${sid}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('POST /api/hermes/sessions/:id/rename updates title', async () => {
    harness = await startHarness()
    const sid = seedSession(harness)
    const res = await fetch(`${harness.url}/api/hermes/sessions/${sid}/rename`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'renamed' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
