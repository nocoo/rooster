import { logger } from './lib/logger.js'
import { getDb } from './services/hermes/db.js'
import { getBridgeClient } from './services/hermes/agent-bridge.js'
import { createHttpServer } from './server.js'

const { httpServer } = createHttpServer({ db: getDb(), bridge: getBridgeClient() })

const port = parseInt(process.env['PORT'] ?? '7038', 10)
const host = process.env['BIND_HOST'] ?? '0.0.0.0'

if (host !== '127.0.0.1' && host !== 'localhost') {
  logger.warn(
    '⚠ Rooster is binding to %s — ensure access is restricted via reverse proxy or firewall. No authentication is built in.',
    host,
  )
}

httpServer.listen(port, host, () => {
  logger.info('Rooster server listening on http://%s:%d', host, port)
})
