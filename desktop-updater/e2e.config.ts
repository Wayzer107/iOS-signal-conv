import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/smoke/**/*.test.ts', 'tests/e2e/**/*.test.ts']
  }
})
