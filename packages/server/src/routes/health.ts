import { Hono } from 'hono'
import type { AgentBridgeClient } from '../services/hermes/agent-bridge.js'

export interface HealthDeps {
  bridge: AgentBridgeClient
}

export function createHealthRoute(deps: HealthDeps): Hono {
  const routes = new Hono()

  routes.get('/', async (c) => {
    let bridgeStatus: 'connected' | 'unreachable'
    try {
      await deps.bridge.ping()
      bridgeStatus = 'connected'
    } catch {
      bridgeStatus = 'unreachable'
    }

    const status = bridgeStatus === 'connected' ? 'ok' : 'degraded'
    return c.json({
      status,
      timestamp: new Date().toISOString(),
      bridge: bridgeStatus,
    })
  })

  return routes
}
