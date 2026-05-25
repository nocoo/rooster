import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
      exclude: [
        'node_modules/**',
        'docs/**',
        'packages/client/src/pages/**',
        'packages/client/src/components/**/*.view.tsx',
      ],
    },
  },
})
