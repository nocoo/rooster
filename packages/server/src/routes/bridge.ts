import { Hono } from 'hono'
import type { AgentBridgeClient } from '../services/hermes/agent-bridge.js'

export function createBridgeRoutes(bridge: AgentBridgeClient): Hono {
  const routes = new Hono()

  routes.get('/profiles', async (c) => {
    const result = await bridge['request']({ action: 'list' })
    const sessions = (result['sessions'] ?? []) as Array<Record<string, unknown>>
    const profiles = [...new Set(
      sessions.map((s) => s['profile']).filter((p): p is string => typeof p === 'string'),
    )]
    return c.json({ profiles })
  })

  routes.get('/models', async (c) => {
    const result = await bridge['request']({ action: 'list' })
    const sessions = (result['sessions'] ?? []) as Array<Record<string, unknown>>
    const models = [...new Set(
      sessions.map((s) => s['model']).filter((m): m is string => typeof m === 'string'),
    )]
    return c.json({ models })
  })

  routes.get('/providers', async (c) => {
    const result = await bridge['request']({ action: 'list' })
    const sessions = (result['sessions'] ?? []) as Array<Record<string, unknown>>
    const providers = [...new Set(
      sessions.map((s) => s['provider']).filter((p): p is string => typeof p === 'string'),
    )]
    return c.json({ providers })
  })

  return routes
}
