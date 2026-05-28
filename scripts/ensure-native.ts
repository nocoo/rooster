import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localBin = resolve(root, 'node_modules/.bin')

/**
 * Resolve the on-disk package root of better-sqlite3 regardless of where
 * bun has placed it (workspace hoist target may be the root `node_modules/`,
 * a `.bun/` cache, or a per-workspace `packages/server/node_modules/`).
 *
 * We start from `packages/server/package.json` because that's the workspace
 * that depends on better-sqlite3 — its require resolver will find the
 * package wherever bun linked it. Then we walk up from the resolved
 * `index.js` until we find the directory containing the package.json so we
 * can run native build tools (`prebuild-install` / `node-gyp`) in the
 * right cwd.
 */
function resolvePackageRoot(pkgName: string): string {
  const anchor = resolve(root, 'packages/server/package.json')
  const req = createRequire(anchor)
  const main = req.resolve(pkgName)
  let dir = dirname(main)
  while (dir !== '/' && dir.length > 1) {
    if (existsSync(resolve(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  throw new Error(`[rebuild:native] could not locate package root for ${pkgName} from ${main}`)
}

const pkg = resolvePackageRoot('better-sqlite3')
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

console.log(`[rebuild:native] ABI mismatch detected at ${pkg}, rebuilding for Node ${process.version}...`)

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
