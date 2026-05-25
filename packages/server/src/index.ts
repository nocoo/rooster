import { serve } from '@hono/node-server'
import { logger } from './lib/logger.js'
import { createApp } from './app.js'
import { getDb } from './services/hermes/db.js'
import { getBridgeClient } from './services/hermes/agent-bridge.js'

const app = createApp({ db: getDb(), bridge: getBridgeClient() })

const port = parseInt(process.env['PORT'] ?? '8648', 10)
const host = process.env['BIND_HOST'] ?? '127.0.0.1'

if (host !== '127.0.0.1' && host !== 'localhost') {
  logger.warn(
    '⚠ Rooster is binding to %s — ensure access is restricted via reverse proxy or firewall. No authentication is built in.',
    host,
  )
}

serve({ fetch: app.fetch, port, hostname: host }, () => {
  logger.info('Rooster server listening on http://%s:%d', host, port)
})

export { app }
