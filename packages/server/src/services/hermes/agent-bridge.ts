import net from 'node:net'
import { logger } from '../../lib/logger.js'

export interface AgentBridgeResponse {
  ok: boolean
  [key: string]: unknown
}

export interface AgentBridgeChatStarted extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: 'running' | 'complete' | 'interrupted' | 'error'
}

export interface AgentBridgeOutput extends AgentBridgeResponse {
  run_id: string
  session_id: string
  status: 'running' | 'complete' | 'interrupted' | 'error'
  delta: string
  cursor: number
  output: string
  done: boolean
  result?: unknown
  error?: string | null
  events: Array<Record<string, unknown>>
  event_cursor: number
}

export interface AgentBridgeOptions {
  endpoint?: string
  timeoutMs?: number
  connectRetryMs?: number
}

const RETRYABLE_CODES = new Set([
  'ECONNREFUSED',
  'ENOENT',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
])

function parseEndpoint(endpoint: string): net.NetConnectOpts {
  if (endpoint.startsWith('tcp://')) {
    const rest = endpoint.slice(6)
    const [host, portStr] = rest.split(':') as [string, string | undefined]
    return { host, port: parseInt(portStr ?? '18765', 10) }
  }
  if (endpoint.startsWith('ipc://')) {
    return { path: endpoint.slice(6) }
  }
  return { path: endpoint }
}

export class AgentBridgeClient {
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly connectRetryMs: number
  private lock: Promise<void> = Promise.resolve()

  constructor(options: AgentBridgeOptions = {}) {
    this.endpoint =
      options.endpoint ??
      process.env['HERMES_AGENT_BRIDGE_ENDPOINT'] ??
      '/tmp/hermes-agent-bridge.sock'
    this.timeoutMs = options.timeoutMs ?? 120_000
    this.connectRetryMs = options.connectRetryMs ?? 5_000
  }

  async ping(): Promise<AgentBridgeResponse> {
    return this.request({ action: 'ping' })
  }

  async chat(
    sessionId: string,
    message: string | Array<Record<string, unknown>>,
    options?: {
      profile?: string
      model?: string
      provider?: string
      force_compress?: boolean
      source?: string
      instructions?: string
      storage_message?: string | Array<Record<string, unknown>>
    },
  ): Promise<AgentBridgeChatStarted> {
    return this.request<AgentBridgeChatStarted>({
      action: 'chat',
      session_id: sessionId,
      message,
      ...options,
    })
  }

  async getOutput(
    runId: string,
    cursor = 0,
    eventCursor = 0,
  ): Promise<AgentBridgeOutput> {
    return this.request<AgentBridgeOutput>({
      action: 'get_output',
      run_id: runId,
      cursor,
      event_cursor: eventCursor,
    })
  }

  async interrupt(
    sessionId: string,
    message?: string,
  ): Promise<AgentBridgeResponse> {
    return this.request({
      action: 'interrupt',
      session_id: sessionId,
      ...(message !== undefined ? { message } : {}),
    })
  }

  async approvalRespond(
    approvalId: string,
    choice: string,
  ): Promise<AgentBridgeResponse> {
    return this.request({
      action: 'approval_respond',
      approval_id: approvalId,
      choice,
    })
  }

  async clarifyRespond(
    clarifyId: string,
    response: string,
  ): Promise<AgentBridgeResponse> {
    return this.request({
      action: 'clarify_respond',
      clarify_id: clarifyId,
      response,
    })
  }

  private request<T extends AgentBridgeResponse = AgentBridgeResponse>(
    payload: Record<string, unknown>,
  ): Promise<T> {
    const execute = (): Promise<T> => {
      const data = JSON.stringify(payload) + '\n'
      const connectOpts = parseEndpoint(this.endpoint)
      const deadline = Date.now() + this.connectRetryMs
      const retryInterval = 100

      const attempt = (): Promise<T> =>
        new Promise((resolve, reject) => {
          const socket = net.connect(connectOpts)
          let responseData = ''
          let settled = false

          const timeout = setTimeout(() => {
            /* v8 ignore next 4 -- guard for race where response arrives just before timeout fires */
            if (!settled) {
              settled = true
              socket.destroy()
              reject(new Error(`Agent bridge timeout after ${String(this.timeoutMs)}ms`))
            }
          }, this.timeoutMs)

          socket.on('connect', () => {
            socket.write(data)
          })

          socket.on('data', (chunk) => {
            responseData += chunk.toString()
            const newlineIdx = responseData.indexOf('\n')
            if (newlineIdx !== -1) {
              clearTimeout(timeout)
              settled = true
              socket.destroy()
              try {
                const parsed = JSON.parse(responseData.slice(0, newlineIdx)) as T
                if (!parsed.ok) {
                  reject(
                    new AgentBridgeError(
                      (parsed['error'] as string | undefined) ??
                        'Bridge returned ok:false',
                      parsed,
                    ),
                  )
                } else {
                  resolve(parsed)
                }
              } catch (e) {
                reject(new Error(`Failed to parse bridge response: ${String(e)}`))
              }
            }
          })

          socket.on('error', (err) => {
            if (!settled) {
              clearTimeout(timeout)
              settled = true
              reject(err)
            }
          })
        })

      const retryLoop = (err: unknown): Promise<T> => {
        const errCode = (err as NodeJS.ErrnoException).code
        if (errCode && RETRYABLE_CODES.has(errCode) && Date.now() < deadline) {
          return new Promise((r) => setTimeout(r, retryInterval)).then(attempt).catch(retryLoop)
        }
        if (err instanceof AgentBridgeError) throw err
        const msg = err instanceof Error ? err.message : String(err)
        throw new AgentBridgeError(`Bridge connection error: ${msg}`)
      }

      return attempt().catch(retryLoop)
    }

    const prev = this.lock
    const next = prev.then(execute, execute)
    this.lock = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

export class AgentBridgeError extends Error {
  constructor(
    message: string,
    public readonly response?: AgentBridgeResponse,
  ) {
    super(message)
    this.name = 'AgentBridgeError'
  }
}

let defaultClient: AgentBridgeClient | null = null

export function getBridgeClient(): AgentBridgeClient {
  if (!defaultClient) {
    defaultClient = new AgentBridgeClient()
    logger.info('Agent bridge client initialized: %s', defaultClient['endpoint'])
  }
  return defaultClient
}
