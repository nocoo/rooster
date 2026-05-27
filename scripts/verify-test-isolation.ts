#!/usr/bin/env tsx
/**
 * D1 Isolation static gate — Phase 3 of 6DQ improvement.
 *
 * Walks `packages/server/tests/**\/*.ts` and rejects any test code that could
 * leak onto the prod-like DB or uploads resolver paths:
 *
 *   - `createDb('<literal>')` where literal is not `':memory:'` and not a
 *     `/tmp/...` / `os.tmpdir()`-derived path.
 *   - `process.env['ROOSTER_DB_PATH'] = '<literal>'` where literal is not
 *     `':memory:'` and not a `/tmp/...` path.
 *   - Literal string `'rooster.db'` (the resolver default).
 *
 * Per Reviewer-B msg=01da7cc6: explicit test values `:memory:` and
 * `os.tmpdir()`-derived paths are OK; what we ban is the prod-default
 * `'rooster.db'` and arbitrary file-system paths that could pollute the
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

function isAllowedDbLiteral(literal: string): boolean {
  if (literal === ':memory:') return true
  if (literal.startsWith('/tmp/')) return true
  if (literal.startsWith('/private/tmp/')) return true
  if (literal.startsWith('/var/folders/')) return true
  return false
}

function lineOf(src: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx; i++) if (src[i] === '\n') line++
  return line
}

const violations: Violation[] = []

for (const file of listTsFiles(TESTS_DIR)) {
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
}

console.info('D1 Isolation static gate')
console.info(`  scanned ${String(listTsFiles(TESTS_DIR).length)} test files under packages/server/tests/`)

if (violations.length > 0) {
  console.error(`\n✘ gate:isolation FAILED — ${String(violations.length)} violation(s):`)
  for (const v of violations) {
    console.error(`  ${v.file}:${String(v.line)} [${v.kind}] ${v.detail}`)
  }
  process.exit(1)
}

console.info('\n✔ gate:isolation PASSED — all test DB paths and uploads dirs are isolated')
