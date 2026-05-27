import { Hono } from 'hono'
import type { Context } from 'hono'
import type { SessionStore } from '../services/hermes/session-store.js'
import type { MessageStore } from '../services/hermes/message-store.js'
import type { AgentBridgeClient } from '../services/hermes/agent-bridge.js'
import { exportSession } from '../services/hermes/session-export.js'

export interface SessionRouteDeps {
  sessionStore: SessionStore
  messageStore: MessageStore
  bridge: AgentBridgeClient
}

function validateIntParam(value: string | undefined, fallback: number, min: number, max: number): number | null {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null
  if (parsed < min || parsed > max) return null
  return parsed
}

function createSearchHandler(sessionStore: SessionStore) {
  return (c: Context) => {
    const q = c.req.query('q')
    if (!q || q.trim() === '') {
      return c.json({ error: 'Query parameter "q" is required' }, 400)
    }
    const limit = validateIntParam(c.req.query('limit'), 20, 1, 100)
    if (limit === null) {
      return c.json({ error: 'Invalid "limit" parameter: must be an integer between 1 and 100' }, 400)
    }
    const offset = validateIntParam(c.req.query('offset'), 0, 0, 100000)
    if (offset === null) {
      return c.json({ error: 'Invalid "offset" parameter: must be a non-negative integer' }, 400)
    }
    const results = sessionStore.search({ q: q.trim(), limit, offset })
    const total = sessionStore.searchCount(q.trim())
    return c.json({ results, total })
  }
}

export function createSearchRoutes(deps: Pick<SessionRouteDeps, 'sessionStore'>): Hono {
  const routes = new Hono()
  routes.get('/sessions', createSearchHandler(deps.sessionStore))
  return routes
}

export function createSessionRoutes(deps: SessionRouteDeps): Hono {
  const { sessionStore, messageStore, bridge } = deps
  const routes = new Hono()

  // Alias: /api/hermes/sessions/search (backwards compat)
  routes.get('/search', createSearchHandler(sessionStore))

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

  routes.get('/:id/export', (c) => {
    const id = c.req.param('id')
    const format = c.req.query('format') ?? 'json'
    if (format !== 'json' && format !== 'markdown') {
      return c.json({ error: 'Invalid format. Use "json" or "markdown"' }, 400)
    }
    const session = sessionStore.get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    const messages = messageStore.list(id)
    const exported = exportSession(session, messages, format)

    if (format === 'markdown') {
      return c.text(exported)
    }
    return c.json(JSON.parse(exported))
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
