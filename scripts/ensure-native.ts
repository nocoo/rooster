import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/server/node_modules/better-sqlite3')
const localBin = resolve(root, 'node_modules/.bin')
const req = createRequire(resolve(pkg, 'index.js'))

function check(): boolean {
  try {
    const Database = req('better-sqlite3') as new (path: string) => { close(): void }
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

const env = { ...process.env, PATH: `${localBin}:${process.env['PATH'] ?? ''}` }

try {
  execSync('prebuild-install', { cwd: pkg, stdio: 'inherit', env })
} catch {
  console.log('[rebuild:native] prebuild-install failed, falling back to node-gyp...')
  execSync('node-gyp rebuild --release', { cwd: pkg, stdio: 'inherit', env })
}

if (check()) {
  console.log('[rebuild:native] rebuild successful.')
  process.exit(0)
}

console.error('[rebuild:native] rebuild completed but ABI still mismatches. Check your Node version.')
process.exit(1)
