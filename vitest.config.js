import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/monitoring/**', 'src/storage/PostgresStorage.js'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 60,
        lines: 70
      }
    },
    include: ['tests/**/*.test.js'],
    testTimeout: 10000
  }
});
