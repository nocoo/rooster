import { join } from 'node:path'
import { Hono } from 'hono'
import { createHealthRoute } from './routes/health.js'
import { createSessionRoutes, createSearchRoutes } from './routes/sessions.js'
import { createBridgeRoutes } from './routes/bridge.js'
import { createUploadRoutes } from './routes/upload.js'
import { SessionStore } from './services/hermes/session-store.js'
import { MessageStore } from './services/hermes/message-store.js'
import { AttachmentStore } from './services/hermes/attachment-store.js'
import type Database from 'better-sqlite3'
import type { AgentBridgeClient } from './services/hermes/agent-bridge.js'

export interface AppDeps {
  db: Database.Database
  bridge: AgentBridgeClient
  uploadsDir?: string
}

export function createApp(deps: AppDeps): Hono {
  const sessionStore = new SessionStore(deps.db)
  const messageStore = new MessageStore(deps.db)
  const attachmentStore = new AttachmentStore(deps.db)
  const uploadsDir = deps.uploadsDir ?? join(process.cwd(), 'uploads')

  const app = new Hono()
  app.route('/health', createHealthRoute({ bridge: deps.bridge }))
  app.route('/api/hermes/search', createSearchRoutes({ sessionStore }))
  app.route('/api/hermes/sessions', createSessionRoutes({ sessionStore, messageStore, bridge: deps.bridge }))
  app.route('/api/hermes', createBridgeRoutes(deps.bridge))
  app.route('/api/upload', createUploadRoutes({ attachmentStore, sessionStore, uploadsDir }))
  return app
}
