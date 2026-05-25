import { Hono } from 'hono'
import { healthRoute } from './routes/health.js'
import { createSessionRoutes } from './routes/sessions.js'
import { createBridgeRoutes } from './routes/bridge.js'
import { SessionStore } from './services/hermes/session-store.js'
import { MessageStore } from './services/hermes/message-store.js'
import type Database from 'better-sqlite3'
import type { AgentBridgeClient } from './services/hermes/agent-bridge.js'

export interface AppDeps {
  db: Database.Database
  bridge: AgentBridgeClient
}

export function createApp(deps: AppDeps): Hono {
  const sessionStore = new SessionStore(deps.db)
  const messageStore = new MessageStore(deps.db)

  const app = new Hono()
  app.route('/health', healthRoute)
  app.route('/api/hermes/sessions', createSessionRoutes({ sessionStore, messageStore, bridge: deps.bridge }))
  app.route('/api/hermes', createBridgeRoutes(deps.bridge))
  return app
}
