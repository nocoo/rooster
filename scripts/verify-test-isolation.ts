#!/usr/bin/env tsx
/**
 * D1 + uploads isolation static gate — Phase 3 of 6DQ improvement.
 *
 * Walks `packages/server/tests/**\/*.ts` and rejects any test code that could
 * leak onto the prod-like DB or the resolver-default uploads directory.
 *
 * Checks:
 *   - `createDb('<literal>')` where literal is not `':memory:'` and not a
 *     `/tmp/...` / `os.tmpdir()`-derived path.
 *   - `process.env['ROOSTER_DB_PATH'] = '<literal>'` where literal is not
 *     `':memory:'` and not a `/tmp/...` path.
 *   - Literal string `'rooster.db'` (the resolver default).
 *   - `createApp({ ... })` / `createHttpServer({ ... })` call sites whose
 *     deps object literal does not pass `uploadsDir`. Without this the
 *     resolver falls back to `join(process.cwd(), 'uploads')` and tests
 *     would write into the repo working tree.
 *   - `uploadsDir: '<literal>'` where literal is not a `/tmp/...` /
 *     `/private/tmp/...` / `/var/folders/...` path (i.e. not under
 *     `os.tmpdir()`).
 *
 * Per Reviewer-B msg=01da7cc6 / msg=bae15b4f: explicit test values
 * `:memory:` and `os.tmpdir()`-derived paths are OK; what we ban is the
 * prod-default and arbitrary file-system paths that could pollute the
 * developer's working tree.
 *
 * No business src changes; tests/scripts only.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const TESTS_DIR = join(REPO_ROOT, 'packages/server/tests')

interface Violation {
  file: string
  line: number
  kind: string
  detail: string
}

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTsFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

function isAllowedTmpLiteral(literal: string): boolean {
  if (literal.startsWith('/tmp/')) return true
  if (literal.startsWith('/private/tmp/')) return true
  if (literal.startsWith('/var/folders/')) return true
  return false
}

function isAllowedDbLiteral(literal: string): boolean {
  if (literal === ':memory:') return true
  return isAllowedTmpLiteral(literal)
}

function lineOf(src: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx; i++) if (src[i] === '\n') line++
  return line
}

/**
 * Find the object literal starting at `openIdx` (must point at `{`) and
 * return [start, endExclusive] indices spanning the matching closing `}`.
 * Tracks string and template-literal nesting just well enough for our test
 * code — not a real parser.
 */
function findObjectLiteral(src: string, openIdx: number): [number, number] | null {
  if (src[openIdx] !== '{') return null
  let depth = 0
  let i = openIdx
  let inStr: '"' | "'" | '`' | null = null
  while (i < src.length) {
    const ch = src[i]
    const prev = i > 0 ? src[i - 1] : ''
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return [openIdx, i + 1]
      }
    }
    i++
  }
  return null
}

/** Skip whitespace forward starting at idx. */
function skipWs(src: string, idx: number): number {
  while (idx < src.length && /\s/.test(src[idx] ?? '')) idx++
  return idx
}

const violations: Violation[] = []
const tsFiles = listTsFiles(TESTS_DIR)

for (const file of tsFiles) {
  const src = readFileSync(file, 'utf-8')
  const rel = relative(REPO_ROOT, file)

  const createDbRe = /createDb\(\s*'([^']*)'\s*\)/g
  let m: RegExpExecArray | null
  while ((m = createDbRe.exec(src)) !== null) {
    const lit = m[1]
    if (lit === undefined) continue
    if (!isAllowedDbLiteral(lit)) {
      violations.push({
        file: rel,
        line: lineOf(src, m.index),
        kind: 'createDb-literal',
        detail: `createDb('${lit}') is not ':memory:' nor under /tmp / /private/tmp / /var/folders`,
      })
    }
  }

  const envAssignRe = /process\.env\[\s*'ROOSTER_DB_PATH'\s*\]\s*=\s*'([^']*)'/g
  while ((m = envAssignRe.exec(src)) !== null) {
    const lit = m[1]
    if (lit === undefined) continue
    if (!isAllowedDbLiteral(lit)) {
      violations.push({
        file: rel,
        line: lineOf(src, m.index),
        kind: 'ROOSTER_DB_PATH-assign',
        detail: `ROOSTER_DB_PATH='${lit}' is not ':memory:' nor under /tmp / /private/tmp / /var/folders`,
      })
    }
  }

  const defaultLitRe = /'rooster\.db'/g
  while ((m = defaultLitRe.exec(src)) !== null) {
    violations.push({
      file: rel,
      line: lineOf(src, m.index),
      kind: 'rooster.db-default-literal',
      detail: `tests must not reference the resolver default 'rooster.db'`,
    })
  }

  const appFactoryRe = /\b(createApp|createHttpServer)\s*\(/g
  while ((m = appFactoryRe.exec(src)) !== null) {
    const factory = m[1] ?? ''
    const argStart = skipWs(src, m.index + m[0].length)
    if (src[argStart] !== '{') continue
    const span = findObjectLiteral(src, argStart)
    if (!span) continue
    const body = src.slice(span[0], span[1])
    if (!/\buploadsDir\b/.test(body)) {
      violations.push({
        file: rel,
        line: lineOf(src, m.index),
        kind: 'missing-uploadsDir',
        detail: `${factory}({...}) call must pass an explicit uploadsDir; the resolver default falls back to process.cwd()/uploads`,
      })
    }
  }

  const uploadsLitRe = /\buploadsDir\s*[:=]\s*'([^']*)'/g
  while ((m = uploadsLitRe.exec(src)) !== null) {
    const lit = m[1]
    if (lit === undefined) continue
    if (!isAllowedTmpLiteral(lit)) {
      violations.push({
        file: rel,
        line: lineOf(src, m.index),
        kind: 'uploadsDir-literal',
        detail: `uploadsDir='${lit}' must be under /tmp / /private/tmp / /var/folders (os.tmpdir())`,
      })
    }
  }
}

console.info('D1 + uploads isolation static gate')
console.info(`  scanned ${String(tsFiles.length)} test files under packages/server/tests/`)

if (violations.length > 0) {
  console.error(`\n✘ gate:isolation FAILED — ${String(violations.length)} violation(s):`)
  for (const v of violations) {
    console.error(`  ${v.file}:${String(v.line)} [${v.kind}] ${v.detail}`)
  }
  process.exit(1)
}

console.info(
  '\n✔ gate:isolation PASSED — test DB paths are :memory: or os.tmpdir() rooted; ' +
    'createApp/createHttpServer call sites pass explicit uploadsDir under os.tmpdir()',
)
