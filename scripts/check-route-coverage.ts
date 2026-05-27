#!/usr/bin/env tsx
/**
 * L2 Route × Method coverage gate (report mode by Phase 2 sub-commit 3).
 *
 * Walks `packages/server/src/routes/**` for Hono handlers and
 * `packages/server/src/services/hermes/chat-run/*.ts` for Socket.IO events,
 * then walks `packages/server/tests/e2e/**\/*.e2e.test.ts` looking for matching
 * `fetch(<url>, { method })` / `client.emit(<event>)` / `client.on(<event>)`
 * calls.
 *
 * Modes:
 *   --report (default): print covered/uncovered, exit 0
 *   --strict           : exit 1 if any route × method is uncovered
 *
 * No business-src changes; tests-only. See docs/08-6dq-improvement.md §2.
 */

import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const SERVER_SRC = join(REPO_ROOT, 'packages/server/src')
const E2E_DIR = join(REPO_ROOT, 'packages/server/tests/e2e')

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

interface RouteEntry {
  method: HttpMethod
  path: string
  source: string
}

interface SocketEvent {
  direction: 'client-to-server' | 'server-to-client'
  event: string
  source: string
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function listFiles(dir: string, suffix: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, suffix))
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full)
  }
  return out
}

function parseAppMounts(appSrc: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /app\.route\(\s*'([^']+)'\s*,\s*(create[A-Za-z]+)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(appSrc)) !== null) {
    const prefix = m[1]
    const factory = m[2]
    if (prefix !== undefined && factory !== undefined) out.set(factory, prefix)
  }
  return out
}

function parseRouteHandlers(file: string, factoryToPrefix: Map<string, string>): RouteEntry[] {
  const src = readText(file)
  const entries: RouteEntry[] = []
  const factoryRe = /export\s+function\s+(create[A-Za-z]+)\s*\(/g
  const factories: Array<{ name: string; start: number }> = []
  let fm: RegExpExecArray | null
  while ((fm = factoryRe.exec(src)) !== null) {
    const name = fm[1]
    if (name !== undefined) factories.push({ name, start: fm.index })
  }
  factories.sort((a, b) => a.start - b.start)
  const handlerRe = /routes\.(get|post|put|delete|patch)\(\s*'([^']+)'/g
  let hm: RegExpExecArray | null
  while ((hm = handlerRe.exec(src)) !== null) {
    const method = hm[1] as HttpMethod
    const localPath = hm[2]
    if (localPath === undefined) continue
    let factoryName: string | undefined
    for (const f of factories) if (f.start < hm.index) factoryName = f.name
    if (factoryName === undefined) continue
    const prefix = factoryToPrefix.get(factoryName)
    if (prefix === undefined) continue
    const composed = composePath(prefix, localPath)
    entries.push({ method, path: composed, source: file })
  }
  return entries
}

function composePath(prefix: string, local: string): string {
  const p = prefix.replace(/\/+$/, '')
  const l = local === '/' ? '' : local.startsWith('/') ? local : `/${local}`
  const joined = `${p}${l}`
  return joined === '' ? '/' : joined
}

function parseSocketEvents(socketSrc: string, bridgeRunSrc: string): SocketEvent[] {
  const events: SocketEvent[] = []
  const onRe = /socket\.on\(\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = onRe.exec(socketSrc)) !== null) {
    const evt = m[1]
    if (evt === undefined || evt === 'disconnect') continue
    events.push({ direction: 'client-to-server', event: evt, source: 'chat-run/socket.ts' })
  }
  const emitRe = /(?:socket|emitter)\.emit\(\s*'([^']+)'/g
  for (const [src, label] of [
    [socketSrc, 'chat-run/socket.ts'],
    [bridgeRunSrc, 'chat-run/bridge-run.ts'],
  ] as const) {
    let em: RegExpExecArray | null
    while ((em = emitRe.exec(src)) !== null) {
      const evt = em[1]
      if (evt === undefined) continue
      events.push({ direction: 'server-to-client', event: evt, source: label })
    }
  }
  const seen = new Set<string>()
  return events.filter((e) => {
    const key = `${e.direction}:${e.event}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface E2eHits {
  fetches: Array<{ method: HttpMethod; path: string }>
  clientEmits: Set<string>
  clientOns: Set<string>
}

function scanE2e(): E2eHits {
  const hits: E2eHits = { fetches: [], clientEmits: new Set(), clientOns: new Set() }
  const files = listFiles(E2E_DIR, '.test.ts')
  for (const f of files) {
    const src = readText(f)
    const fetchRe = /fetch\(\s*`([^`]+)`(?:\s*,\s*\{([^}]*)\})?/g
    let m: RegExpExecArray | null
    while ((m = fetchRe.exec(src)) !== null) {
      const url = m[1]
      const opts = m[2]
      if (url === undefined) continue
      const path = extractPathFromUrl(url)
      if (path === undefined) continue
      const methodLit = opts !== undefined ? /method\s*:\s*'([^']+)'/.exec(opts)?.[1] : undefined
      const method = (methodLit?.toLowerCase() ?? 'get') as HttpMethod
      hits.fetches.push({ method, path })
    }
    const emitRe = /client\.emit\(\s*'([^']+)'/g
    while ((m = emitRe.exec(src)) !== null) {
      const evt = m[1]
      if (evt !== undefined) hits.clientEmits.add(evt)
    }
    const onRe = /client\.on\(\s*'([^']+)'/g
    while ((m = onRe.exec(src)) !== null) {
      const evt = m[1]
      if (evt !== undefined && evt !== 'connect' && evt !== 'disconnect') hits.clientOns.add(evt)
    }
  }
  return hits
}

function extractPathFromUrl(raw: string): string | undefined {
  const stripped = raw.replace(/^\$\{[^}]+\}/, '')
  const m = /^https?:\/\/[^/]+(\/.*)$/.exec(stripped)
  const path = m ? (m[1] ?? '') : stripped
  if (!path.startsWith('/')) return undefined
  const cleaned = path.replace(/\$\{[^}]+\}/g, '_')
  return cleaned.split('?')[0]
}

function matchesRoute(route: RouteEntry, fetchPath: string): boolean {
  const pat = '^' + route.path.replace(/\//g, '\\/').replace(/:[A-Za-z_]+/g, '[^/]+') + '$'
  return new RegExp(pat).test(fetchPath)
}

const appSrc = readText(join(SERVER_SRC, 'app.ts'))
const factoryToPrefix = parseAppMounts(appSrc)

const routes: RouteEntry[] = []
for (const f of listFiles(join(SERVER_SRC, 'routes'), '.ts')) {
  routes.push(...parseRouteHandlers(f, factoryToPrefix))
}

const socketSrc = readText(join(SERVER_SRC, 'services/hermes/chat-run/socket.ts'))
const bridgeRunSrc = readText(join(SERVER_SRC, 'services/hermes/chat-run/bridge-run.ts'))
const events = parseSocketEvents(socketSrc, bridgeRunSrc)

const hits = scanE2e()

const uncoveredRoutes: RouteEntry[] = []
for (const r of routes) {
  const ok = hits.fetches.some((h) => h.method === r.method && matchesRoute(r, h.path))
  if (!ok) uncoveredRoutes.push(r)
}

const uncoveredEvents: SocketEvent[] = []
for (const e of events) {
  const set = e.direction === 'client-to-server' ? hits.clientEmits : hits.clientOns
  if (!set.has(e.event)) uncoveredEvents.push(e)
}

const mode = process.argv.includes('--strict') ? 'strict' : 'report'

const totalRoutes = routes.length
const totalEvents = events.length
const coveredRoutes = totalRoutes - uncoveredRoutes.length
const coveredEvents = totalEvents - uncoveredEvents.length

console.info(`L2 route × method coverage gate (${mode})`)
console.info(`  HTTP    : ${String(coveredRoutes)}/${String(totalRoutes)} covered`)
console.info(`  Socket  : ${String(coveredEvents)}/${String(totalEvents)} covered`)

if (uncoveredRoutes.length > 0) {
  console.info('\nUncovered HTTP route × method:')
  for (const r of uncoveredRoutes) console.info(`  ${r.method.toUpperCase().padEnd(6)} ${r.path}`)
}
if (uncoveredEvents.length > 0) {
  console.info('\nUncovered Socket.IO events:')
  for (const e of uncoveredEvents) console.info(`  [${e.direction}] ${e.event}`)
}

if (mode === 'strict' && (uncoveredRoutes.length > 0 || uncoveredEvents.length > 0)) {
  console.error('\n✘ gate:routes FAILED — uncovered routes/events present')
  process.exit(1)
}

console.info('\n✔ gate:routes report complete')
