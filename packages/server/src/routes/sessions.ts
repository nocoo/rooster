import { Hono } from 'hono'
import type { SessionStore } from '../services/hermes/session-store.js'

export function createSessionRoutes(store: SessionStore): Hono {
  const routes = new Hono()

  routes.get('/', (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10)
    const offset = parseInt(c.req.query('offset') ?? '0', 10)
    const profile = c.req.query('profile')
    const sessions = store.list({ limit, offset, ...(profile ? { profile } : {}) })
    const total = store.count(profile)
    return c.json({ sessions, total })
  })

  routes.get('/:id', (c) => {
    const session = store.get(c.req.param('id'))
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json(session)
  })

  routes.delete('/:id', (c) => {
    const deleted = store.delete(c.req.param('id'))
    if (!deleted) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json({ ok: true })
  })

  routes.post('/:id/rename', async (c) => {
    const body = await c.req.json<{ title: string }>()
    const id = c.req.param('id')
    const session = store.get(id)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    store.updateTitle(id, body.title)
    return c.json({ ok: true })
  })

  return routes
}
