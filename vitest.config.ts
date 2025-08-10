import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'test/workflow/workflow-helpers.ts'
      ],
      exclude: [
        'node_modules/**',
        '**/*.test.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**'
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
})