import { Hono } from 'hono'
import type { SessionStore } from '../services/hermes/session-store.js'
import type { MessageStore } from '../services/hermes/message-store.js'
import type { AgentBridgeClient } from '../services/hermes/agent-bridge.js'

export interface SessionRouteDeps {
  sessionStore: SessionStore
  messageStore: MessageStore
  bridge: AgentBridgeClient
}

export function createSessionRoutes(deps: SessionRouteDeps): Hono {
  const { sessionStore, messageStore, bridge } = deps
  const routes = new Hono()

  routes.get('/', (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const offset = parseInt(c.req.query('offset') ?? '0', 10)
    const profile = c.req.query('profile')
    const sessions = sessionStore.list({ limit, offset, ...(profile ? { profile } : {}) })
    const total = sessionStore.count(profile)
    return c.json({ sessions, total })
  })

  routes.get('/conversations', (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const offset = parseInt(c.req.query('offset') ?? '0', 10)
    const sessions = sessionStore.list({ limit, offset })
    return c.json({ conversations: sessions })
  })

  routes.get('/conversations/:id/messages', (c) => {
    const id = c.req.param('id')
    const session = sessionStore.get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    const messages = messageStore.list(id)
    return c.json({ messages })
  })

  routes.get('/conversations/:id/messages/paginated', (c) => {
    const id = c.req.param('id')
    const session = sessionStore.get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const before = c.req.query('before')
    const after = c.req.query('after')
    const messages = messageStore.paginate(id, {
      limit,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    })
    const total = messageStore.count(id)
    return c.json({ messages, total })
  })

  routes.get('/hermes', async (c) => {
    const result = await bridge['request']({ action: 'list' })
    return c.json(result)
  })

  routes.get('/hermes/:id', async (c) => {
    const id = c.req.param('id')
    const result = await bridge['request']({
      action: 'get_history',
      session_id: id,
    })
    return c.json(result)
  })

  routes.get('/:id', (c) => {
    const session = sessionStore.get(c.req.param('id'))
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json(session)
  })

  routes.delete('/:id', (c) => {
    const deleted = sessionStore.delete(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json({ ok: true })
  })

  routes.post('/:id/rename', async (c) => {
    const body = await c.req.json<{ title: string }>()
    const id = c.req.param('id')
    const session = sessionStore.get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    sessionStore.updateTitle(id, body.title)
    return c.json({ ok: true })
  })

  return routes
}
