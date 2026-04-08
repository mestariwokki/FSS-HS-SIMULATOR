import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/simulation/**/*.ts'],
      exclude: ['src/simulation/__tests__/**'],
      thresholds: { lines: 45, functions: 70, branches: 25 },
    },
  },
})
