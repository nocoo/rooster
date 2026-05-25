#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/server/node_modules/better-sqlite3')
const require = createRequire(resolve(pkg, 'index.js'))

function check() {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

if (check()) {
  process.exit(0)
}

console.log(`[rebuild:native] ABI mismatch detected, rebuilding for Node ${process.version}...`)

try {
  execSync('npx --yes prebuild-install', { cwd: pkg, stdio: 'inherit' })
} catch {
  console.log('[rebuild:native] prebuild-install failed, falling back to node-gyp...')
  execSync('npx --yes node-gyp rebuild --release', { cwd: pkg, stdio: 'inherit' })
}

if (check()) {
  console.log('[rebuild:native] rebuild successful.')
  process.exit(0)
}

console.error('[rebuild:native] rebuild completed but ABI still mismatches. Check your Node version.')
process.exit(1)
