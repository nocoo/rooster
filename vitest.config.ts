import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact({ devToolsEnabled: false })],
  test: {
    setupFiles: ['packages/server/tests/setup-d1-guard.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'packages/server/src/**/*.ts',
        'packages/client/src/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/**',
        'docs/**',
        'packages/server/src/index.ts',
        'packages/client/src/main.tsx',
        'packages/client/src/pages/**',
        'packages/client/src/components/**/*.view.tsx',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
})
