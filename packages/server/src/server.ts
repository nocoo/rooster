import { join } from 'node:path'
import { createServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { getRequestListener } from '@hono/node-server'
import { createApp } from './app.js'
import { registerChatRunNamespace } from './services/hermes/chat-run/socket.js'
import { SessionStore } from './services/hermes/session-store.js'
import { MessageStore } from './services/hermes/message-store.js'
import { AttachmentStore } from './services/hermes/attachment-store.js'
import type { Server } from 'node:http'
import type Database from 'better-sqlite3'
import type { AgentBridgeClient } from './services/hermes/agent-bridge.js'

export interface ServerDeps {
  db: Database.Database
  bridge: AgentBridgeClient
  uploadsDir?: string
}

export interface HttpServer {
  httpServer: Server
  io: SocketIOServer
  close: () => Promise<void>
}

export function createHttpServer(deps: ServerDeps): HttpServer {
  const { db, bridge } = deps
  const uploadsDir = deps.uploadsDir ?? join(process.cwd(), 'uploads')

  const app = createApp({ db, bridge, uploadsDir })
  const sessionStore = new SessionStore(db)
  const messageStore = new MessageStore(db)
  const attachmentStore = new AttachmentStore(db)

  const fetchListener = getRequestListener(app.fetch)
  const httpServer = createServer((req, res) => { void fetchListener(req, res) })

  const io = new SocketIOServer(httpServer)
  registerChatRunNamespace(io, { bridge, sessionStore, messageStore, attachmentStore, uploadsDir })

  const close = async (): Promise<void> => {
    await io.close()
    await new Promise<void>((resolve) => {
      httpServer.close(() => { resolve() })
    })
  }

  return { httpServer, io, close }
}
