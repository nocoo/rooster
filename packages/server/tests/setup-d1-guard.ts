/**
 * D1 Isolation runtime guard — Phase 3 of 6DQ improvement.
 *
 * Loaded as a vitest `setupFiles` entry. Complements the static gate
 * (`scripts/verify-test-isolation.ts`) by catching env-injected drift that
 * regex-based scanning cannot see (e.g. ROOSTER_DB_PATH set in a `.env`,
 * shell, or test wrapper at process start).
 *
 * Per Reviewer-B msg=01da7cc6 / msg=bae15b4f: do NOT blanket-ban
 * ROOSTER_DB_PATH. Explicit `:memory:` and `os.tmpdir()`-rooted paths are
 * legitimate test values; reject only the resolver default (the on-tree
 * sqlite file in db.ts) or any other unspecified filesystem path. Also:
 * this guard lives in the test layer — business `src/` is not modified to
 * monkey-patch `createDb`.
 */

import { beforeAll, beforeEach, afterEach } from 'vitest'

const ALLOWED_PREFIXES = ['/tmp/', '/private/tmp/', '/var/folders/'] as const

function isAllowedDbPath(value: string): boolean {
  if (value === ':memory:') return true
  return ALLOWED_PREFIXES.some((p) => value.startsWith(p))
}

function assertAllowed(value: string | undefined, context: string): void {
  if (value === undefined) return
  if (!isAllowedDbPath(value)) {
    throw new Error(
      `[d1-guard:${context}] ROOSTER_DB_PATH='${value}' is not an allowed test value. ` +
        `Use ':memory:' or a path under /tmp / /private/tmp / /var/folders (os.tmpdir()).`,
    )
  }
}

const initialDbPath = process.env['ROOSTER_DB_PATH']

beforeAll(() => {
  assertAllowed(initialDbPath, 'startup')
})

let perTestSnapshot: string | undefined

beforeEach(() => {
  perTestSnapshot = process.env['ROOSTER_DB_PATH']
})

afterEach(() => {
  const current = process.env['ROOSTER_DB_PATH']
  assertAllowed(current, 'afterEach')
  if (perTestSnapshot === undefined) {
    delete process.env['ROOSTER_DB_PATH']
  } else {
    process.env['ROOSTER_DB_PATH'] = perTestSnapshot
  }
})
