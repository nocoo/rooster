/**
 * D1 Isolation runtime guard — Phase 3 of 6DQ improvement.
 *
 * Loaded as a vitest `setupFiles` entry. Scope is intentionally narrow:
 * this guard only watches `process.env.ROOSTER_DB_PATH`. It catches env
 * drift that regex-based scanning cannot see (e.g. ROOSTER_DB_PATH set in
 * a `.env`, shell, or test wrapper at process start), and prevents tests
 * from leaving the env mutated for later tests.
 *
 * Dynamic `createDb(path)` arguments are NOT intercepted at runtime — that
 * would require monkey-patching the business `src/`, which we explicitly
 * avoid. The static gate (`scripts/verify-test-isolation.ts`) covers the
 * literal-argument case in test code; anything more dynamic is out of
 * scope for both layers and would have to come from a code review.
 *
 * Per Reviewer-B msg=01da7cc6 / msg=bae15b4f: do NOT blanket-ban
 * ROOSTER_DB_PATH. Explicit `:memory:` and `os.tmpdir()`-rooted paths are
 * legitimate test values.
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
