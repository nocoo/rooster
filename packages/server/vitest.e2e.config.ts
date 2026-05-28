import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  test: {
    include: ['tests/e2e/**/*.e2e.test.ts'],
    setupFiles: ['tests/setup-d1-guard.ts'],
  },
})
